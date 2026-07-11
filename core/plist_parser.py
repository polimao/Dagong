"""Info.plist extraction + lightweight structural comparison for iOS apps.

We don't try to diff every key -- only the fields that meaningfully indicate
whether two builds are "the same app / same generation":
  * identity: bundle id, display name, executable name
  * version: short version, build number
  * deployment target: MinimumOSVersion
  * device surface: UIDeviceFamily, UIRequiredDeviceCapabilities
  * a few capability hints (camera / bluetooth / location presence)

The comparison is a Jaccard / exact-match blend, not a diff of raw strings,
so reordered or reformatted plists still compare cleanly.
"""

from __future__ import annotations

import plistlib
from dataclasses import dataclass, field
from typing import Any, Optional

# Keys we surface in the report.
SURFACE_KEYS = [
    "CFBundleName",
    "CFBundleDisplayName",
    "CFBundleIdentifier",
    "CFBundleExecutable",
    "CFBundleShortVersionString",
    "CFBundleVersion",
    "MinimumOSVersion",
    "UIDeviceFamily",
    "UIRequiredDeviceCapabilities",
    "DTPlatformVersion",
    "DTSDKName",
]

CAPABILITY_HINTS = {
    "NSCameraUsageDescription": "camera",
    "NSBluetoothAlwaysUsageDescription": "bluetooth",
    "NSBluetoothPeripheralUsageDescription": "bluetooth",
    "NSLocationAlwaysAndWhenInUseUsageDescription": "location",
    "NSLocationWhenInUseUsageDescription": "location",
    "NSMicrophoneUsageDescription": "microphone",
    "NSContactsUsageDescription": "contacts",
    "NSPhotoLibraryUsageDescription": "photos",
}


@dataclass
class PlistInfo:
    available: bool = False
    error: Optional[str] = None
    raw: dict = field(default_factory=dict)
    surface: dict = field(default_factory=dict)
    capability_tokens: set = field(default_factory=set)

    @property
    def bundle_id(self) -> Optional[str]:
        return self.surface.get("CFBundleIdentifier")

    @property
    def short_version(self) -> Optional[str]:
        return self.surface.get("CFBundleShortVersionString")

    @property
    def bundle_version(self) -> Optional[str]:
        return self.surface.get("CFBundleVersion")

    @property
    def executable(self) -> Optional[str]:
        return self.surface.get("CFBundleExecutable")


def _normalize_version(v: Any) -> tuple:
    if v is None:
        return ()
    if isinstance(v, (list, tuple)):
        v = ".".join(str(x) for x in v)
    parts = []
    for p in str(v).split("."):
        try:
            parts.append(int(p))
        except ValueError:
            parts.append(0)
    return tuple(parts)


def _device_family_set(v: Any) -> set:
    if v is None:
        return set()
    if not isinstance(v, (list, tuple)):
        v = [v]
    return set(int(x) for x in v if isinstance(x, (int, float)))


def parse_plist_file(path: str) -> PlistInfo:
    info = PlistInfo()
    try:
        with open(path, "rb") as f:
            raw = plistlib.load(f)
    except Exception as e:  # noqa: BLE001 - plist can fail in many ways
        info.available = False
        info.error = "cannot parse plist: %s" % e
        return info

    if not isinstance(raw, dict):
        info.available = False
        info.error = "plist root is not a dictionary"
        return info

    info.available = True
    info.raw = raw
    surface = {}
    for k in SURFACE_KEYS:
        if k in raw:
            surface[k] = raw[k]
    info.surface = surface

    caps: set = set()
    for key, token in CAPABILITY_HINTS.items():
        if key in raw:
            caps.add(token)
    # UIRequiredDeviceCapabilities can be a dict or list; flatten to a token set.
    rdc = raw.get("UIRequiredDeviceCapabilities")
    if isinstance(rdc, dict):
        caps.update("rdc:%s" % k for k in rdc.keys())
    elif isinstance(rdc, (list, tuple)):
        caps.update("rdc:%s" % x for x in rdc)
    info.capability_tokens = caps
    return info


def compare_plist(a: PlistInfo, b: PlistInfo) -> dict:
    """Return diff + a similarity score in [0, 1]."""
    diffs = []
    all_keys = list(dict.fromkeys(list(a.surface.keys()) + list(b.surface.keys())))
    for k in all_keys:
        av = a.surface.get(k)
        bv = b.surface.get(k)
        if av == bv:
            continue
        if k in ("CFBundleShortVersionString", "CFBundleVersion", "MinimumOSVersion"):
            va, vb = _normalize_version(av), _normalize_version(bv)
            if va == vb:
                continue
        diffs.append({
            "key": k,
            "a": _stringify(av),
            "b": _stringify(bv),
        })

    caps_a, caps_b = a.capability_tokens, b.capability_tokens
    cap_union = caps_a | caps_b
    cap_inter = caps_a & caps_b
    cap_sim = (len(cap_inter) / len(cap_union)) if cap_union else 1.0

    # Version/deployment target exact matches.
    version_keys = ["CFBundleShortVersionString", "CFBundleVersion", "MinimumOSVersion"]
    ver_total = len(version_keys)
    ver_match = sum(1 for k in version_keys if a.surface.get(k) == b.surface.get(k))
    ver_sim = ver_match / ver_total if ver_total else 1.0

    # Identity (bundle id + executable) -- must match for a credible "same app".
    identity_match = (
        a.surface.get("CFBundleIdentifier") == b.surface.get("CFBundleIdentifier")
        and a.surface.get("CFBundleExecutable") == b.surface.get("CFBundleExecutable")
    )

    # Blend: capabilities 40%, version/deploy 40%, identity 20%.
    similarity = 0.4 * cap_sim + 0.4 * ver_sim + (0.2 if identity_match else 0.0)
    return {
        "diffs": diffs,
        "capability_similarity": cap_sim,
        "version_similarity": ver_sim,
        "identity_match": identity_match,
        "similarity": similarity,
    }


def _stringify(v: Any) -> str:
    if v is None:
        return "(missing)"
    if isinstance(v, (list, tuple)):
        return "[" + ", ".join(str(x) for x in v) + "]"
    if isinstance(v, dict):
        return "{...%d keys}" % len(v)
    return str(v)
