"""Minimal, dependency-free Mach-O / Universal (fat) binary parser.

Focused purely on the metrics we need for a binary "code similarity" report:
  * segment total virtual / file size (excluding __PAGEZERO and __LINKEDIT)
  * per-section code/data sizes for the main executable segments
  * number of load commands (raw vs. "meaningful" -- UUID and code-signature
    commands are excluded because they change on every build and are noise)
  * fat-archive architecture list, selecting the arm64 slice by priority

Designed to survive the traps that break naive parsers:
  * Universal (fat) binaries must use ONLY the arm64 slice, never the bundled
    armv7/arm64e noise architectures.
  * __LINKEDIT (codesign/Swift runtime/containment) and __PAGEZERO must not
    pollute the segment totals.
  * `vmaddr` is a load address, never a size -- confusing it is a common bug.
  * Byte order is decided by the magic, not assumed.

No external packages are required, so this runs on the bundled managed Python.
"""

from __future__ import annotations

import struct
from dataclasses import dataclass, field
from typing import Optional

# Load command identifiers
LC_SEGMENT = 0x1          # 32-bit
LC_SEGMENT_64 = 0x19      # 64-bit
LC_UUID = 0x1b
LC_CODE_SIGNATURE = 0x1d

# Segments we never count toward "real" size
EXCLUDED_SEGMENTS = {"__PAGEZERO", "__LINKEDIT"}

# Section names we surface explicitly
SECTION_KEYS = {
    "__text": "sect_text_size",
    "__const": "sect_const_size",
    "__data": "sect_data_size",
    "__objc_const": "sect_objc_size",
}


@dataclass
class MachoStats:
    available: bool = False
    error: Optional[str] = None
    fat: bool = False
    arch: Optional[str] = None
    arch_list: list[str] = field(default_factory=list)
    uuid: Optional[str] = None
    ncmds_raw: int = 0
    ncmds_meaningful: int = 0
    seg_total_vmsize: int = 0
    seg_total_filesize: int = 0
    sect_text_size: int = 0
    sect_const_size: int = 0
    sect_data_size: int = 0
    sect_objc_size: int = 0
    sect_total_size: int = 0


def _read_magic(data: bytes, off: int):
    """Return (endian, kind, bits) for a thin Mach-O at `off`.

    kind in {'thin64','thin32','unknown'}. endian is '<' or '>'.
    """
    if off + 4 > len(data):
        return None, "unknown", 0
    le = int.from_bytes(data[off:off + 4], "little")
    be = int.from_bytes(data[off:off + 4], "big")
    if le == 0xfeedfacf:
        return "<", "thin64", 64
    if be == 0xfeedfacf:
        return ">", "thin64", 64
    if le == 0xfeedface:
        return "<", "thin32", 32
    if be == 0xfeedface:
        return ">", "thin32", 32
    return None, "unknown", 0


def _cputype_to_arch(cputype: int) -> str:
    # Capability bits (ABI64 / ABI64_USER) live in bits 24-27; clear them with
    # the CPU_ARCH_MASK (0x0f000000) to recover the base family.
    family = cputype & 0xF0FFFFFF
    is64 = bool(cputype & 0x01000000)
    if family == 0xC:  # ARM
        return "arm64" if is64 else "armv7"
    if family == 0x7:  # x86
        return "x86_64" if is64 else "x86"
    return "other"


def _is_arm64(cputype: int) -> bool:
    return (cputype & 0xF0FFFFFF) == 0xC and bool(cputype & 0x01000000)


def _parse_thin(data: bytes, base: int, size_hint: int) -> MachoStats:
    endian, kind, bits = _read_magic(data, base)
    s = MachoStats(available=True, fat=False)
    if kind == "unknown":
        s.available = False
        s.error = "not a Mach-O magic at offset %d" % base
        return s

    s.arch = "arm64" if bits == 64 else "arm32"

    if bits == 64:
        header_fmt = endian + "7I"
        header_size = 32
        sect_header_size = 80  # section_64
        sect_addr_off = 32
        sect_size_off = 40
    else:
        header_fmt = endian + "7I"
        header_size = 28
        sect_header_size = 68  # section (32-bit)
        sect_addr_off = 32
        sect_size_off = 36

    try:
        (magic, cputype, cpusubtype, filetype, ncmds, sizeofcmds, flags) = \
            struct.unpack_from(header_fmt, data, base)
    except struct.error as e:
        s.available = False
        s.error = "header truncated: %s" % e
        return s

    s.arch = _cputype_to_arch(cputype)
    s.ncmds_raw = ncmds

    lc_off = base + header_size
    size_limit = base + size_hint if size_hint else len(data)
    off = lc_off
    for _ in range(ncmds):
        if off + 8 > size_limit:
            s.available = False
            s.error = "load command region truncated"
            return s
        try:
            cmd, cmdsize = struct.unpack_from(endian + "II", data, off)
        except struct.error:
            s.available = False
            s.error = "load command truncated"
            return s
        if cmdsize < 8:
            break

        if cmd in (LC_SEGMENT_64, LC_SEGMENT):
            s.ncmds_meaningful += 1
            # segname lives at off+8 (16 bytes); vmaddr/vmsize/fileoff/filesize
            # at off+24 (for 64-bit) / off+24 (for 32-bit too, same layout).
            segname = data[off + 8:off + 24].split(b"\x00", 1)[0].decode("latin1", "replace")
            if bits == 64:
                (vmaddr, vmsize, fileoff, filesize, maxprot, initprot,
                 nsects, flags_seg) = struct.unpack_from(endian + "QQQQIIII", data, off + 24)
            else:
                (vmaddr, vmsize, fileoff, filesize, maxprot, initprot,
                 nsects, flags_seg) = struct.unpack_from(endian + "IIIIIIII", data, off + 24)

            if segname not in EXCLUDED_SEGMENTS:
                s.seg_total_vmsize += vmsize
                s.seg_total_filesize += filesize

            if nsects > 0:
                sec_off = off + 24 + (4 * 8 + 4 * 4)  # after the segment command fixed part
                for si in range(nsects):
                    if sec_off + sect_header_size > size_limit:
                        break
                    sectname = data[sec_off:sec_off + 16].split(b"\x00", 1)[0].decode("latin1", "replace")
                    addr, size = struct.unpack_from(
                        endian + ("QQ" if bits == 64 else "II"), data,
                        sec_off + sect_addr_off)
                    if sectname in SECTION_KEYS:
                        setattr(s, SECTION_KEYS[sectname], size)
                        s.sect_total_size += size
                    sec_off += sect_header_size

        elif cmd == LC_UUID:
            if off + 24 <= size_limit:
                s.uuid = data[off + 8:off + 24].hex()
            # UUID is not a "meaningful" command for similarity.
        elif cmd == LC_CODE_SIGNATURE:
            # code signature is not "meaningful" either.
            pass
        else:
            s.ncmds_meaningful += 1

        off += cmdsize

    return s


def parse_macho_file(path: str) -> MachoStats:
    try:
        with open(path, "rb") as f:
            data = f.read()
    except OSError as e:
        s = MachoStats(available=False)
        s.error = "cannot read file: %s" % e
        return s

    if len(data) < 4:
        s = MachoStats(available=False)
        s.error = "file too small"
        return s

    # Detect fat (universal) wrapper.
    le = int.from_bytes(data[0:4], "little")
    be = int.from_bytes(data[0:4], "big")
    fat_endian = None
    fat64 = False
    if le == 0xcafebabe or be == 0xcafebabe:
        fat_endian = ">"
    elif le == 0xbebafeca or be == 0xbebafeca:
        fat_endian = "<"
    elif le == 0xcafebabf or be == 0xcafebabf:
        fat_endian = ">"
        fat64 = True

    if fat_endian is None:
        return _parse_thin(data, 0, len(data))

    # Parse fat header.
    try:
        nfat = struct.unpack_from(fat_endian + "I", data, 4)[0]
    except struct.error:
        s = MachoStats(available=False)
        s.error = "fat header truncated"
        return s

    s = MachoStats(available=True, fat=True)
    arch_entries = []
    base = 8
    for _ in range(nfat):
        try:
            if fat64:
                cputype, cpusubtype, offset, size, align, reserved = struct.unpack_from(
                    fat_endian + "IIQQII", data, base)
            else:
                cputype, cpusubtype, offset, size, align = struct.unpack_from(
                    fat_endian + "IIIII", data, base)
                reserved = 0
        except struct.error:
            break
        arch_name = _cputype_to_arch(cputype)
        arch_entries.append((arch_name, cputype, offset, size))
        s.arch_list.append(arch_name)
        base += 32 if fat64 else 20

    # Prefer arm64, else fall back to the first listed architecture.
    chosen = next((e for e in arch_entries if _is_arm64(e[1])), None)
    if chosen is None and arch_entries:
        chosen = arch_entries[0]

    if chosen is None:
        s.available = False
        s.error = "no usable architecture in fat binary"
        return s

    arch_name, cputype, offset, size = chosen
    slice_stats = _parse_thin(data, offset, size)
    # Merge slice stats into the fat wrapper.
    s.arch = arch_name
    s.available = slice_stats.available
    s.error = slice_stats.error
    s.uuid = slice_stats.uuid
    s.ncmds_raw = slice_stats.ncmds_raw
    s.ncmds_meaningful = slice_stats.ncmds_meaningful
    s.seg_total_vmsize = slice_stats.seg_total_vmsize
    s.seg_total_filesize = slice_stats.seg_total_filesize
    s.sect_text_size = slice_stats.sect_text_size
    s.sect_const_size = slice_stats.sect_const_size
    s.sect_data_size = slice_stats.sect_data_size
    s.sect_objc_size = slice_stats.sect_objc_size
    s.sect_total_size = slice_stats.sect_total_size
    return s


def stats_to_dict(s: MachoStats) -> dict:
    return {
        "available": s.available,
        "error": s.error,
        "fat": s.fat,
        "arch": s.arch,
        "arch_list": s.arch_list,
        "uuid": s.uuid,
        "ncmds_raw": s.ncmds_raw,
        "ncmds_meaningful": s.ncmds_meaningful,
        "seg_total_vmsize": s.seg_total_vmsize,
        "seg_total_filesize": s.seg_total_filesize,
        "sect_text_size": s.sect_text_size,
        "sect_const_size": s.sect_const_size,
        "sect_data_size": s.sect_data_size,
        "sect_objc_size": s.sect_objc_size,
        "sect_total_size": s.sect_total_size,
    }


if __name__ == "__main__":
    import sys
    for p in sys.argv[1:]:
        st = parse_macho_file(p)
        print(p)
        for k, v in stats_to_dict(st).items():
            print("  %-20s %s" % (k, v))
