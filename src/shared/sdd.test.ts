import { describe, expect, it } from 'vitest'
import {
  SDD_DRAFT_FILE_NAME,
  buildSddDraftRelativePath,
  isSddDraftRelativePath,
  isSddImageRelativePath,
  isSddPrototypeRelativePath,
  normalizeSddRelativePath,
  sddDraftRelativePathForPlanPath,
  sddDraftTraceRelativePath,
  sddRequirementUnitDir,
  sddUnitChatDir,
  sddUnitImageDir,
  sddUnitProtoDir
} from './sdd'

const UUID = '123e4567-e89b-12d3-a456-426614174000'
const DRAFT = `.dagongsdd/requirements/${UUID}/${SDD_DRAFT_FILE_NAME}`

describe('sdd shared paths', () => {
  it('builds a canonical requirement-unit draft path', () => {
    expect(buildSddDraftRelativePath(UUID)).toBe(DRAFT)
  })

  it('validates only uuid-backed requirement drafts under requirements/', () => {
    expect(isSddDraftRelativePath(DRAFT)).toBe(true)
    expect(isSddDraftRelativePath(`.dagongsdd/requirements/not-a-uuid/requirement.md`)).toBe(false)
    expect(isSddDraftRelativePath(`.dagongsdd/requirements/${UUID}/other.md`)).toBe(false)
    expect(isSddDraftRelativePath(`.dagongsdd/requirements/${UUID}/nested/requirement.md`)).toBe(false)
    // The pre-unit layout is explicitly retired (clean switch, no migration).
    expect(isSddDraftRelativePath(`.dagongsdd/draft/${UUID}/requirement.md`)).toBe(false)
  })

  it('derives the unit directories from the draft path', () => {
    expect(sddRequirementUnitDir(DRAFT)).toBe(`.dagongsdd/requirements/${UUID}`)
    expect(sddUnitImageDir(DRAFT)).toBe(`.dagongsdd/requirements/${UUID}/img`)
    expect(sddUnitProtoDir(DRAFT)).toBe(`.dagongsdd/requirements/${UUID}/proto`)
    expect(sddUnitChatDir(DRAFT)).toBe(`.dagongsdd/requirements/${UUID}/chat`)
    expect(sddDraftTraceRelativePath(DRAFT)).toBe(`.dagongsdd/requirements/${UUID}/trace.json`)
    expect(sddRequirementUnitDir(`.dagongsdd/draft/${UUID}/requirement.md`)).toBeNull()
    expect(sddUnitImageDir('not-a-draft.md')).toBeNull()
  })

  it('maps SDD plan paths back to the requirement unit', () => {
    expect(sddDraftRelativePathForPlanPath(`.dagongsdd/plan/sdd-${UUID}.md`)).toBe(DRAFT)
    expect(sddDraftRelativePathForPlanPath(`.dagongsdd/plan/sdd-${UUID}-2.md`)).toBe(DRAFT)
    expect(sddDraftRelativePathForPlanPath('.dagongsdd/plan/other.md')).toBeNull()
  })

  it('validates per-unit image and prototype paths', () => {
    expect(normalizeSddRelativePath(`./.dagongsdd\\requirements\\${UUID}\\img\\a.png`)).toBe(
      `.dagongsdd/requirements/${UUID}/img/a.png`
    )
    expect(isSddImageRelativePath(`.dagongsdd/requirements/${UUID}/img/wireframe.png`)).toBe(true)
    expect(isSddImageRelativePath(`.dagongsdd/requirements/${UUID}/img/nested/wireframe.png`)).toBe(true)
    expect(isSddImageRelativePath(`.dagongsdd/requirements/${UUID}/img/../escape.png`)).toBe(false)
    expect(isSddImageRelativePath(`.dagongsdd/requirements/not-a-uuid/img/a.png`)).toBe(false)
    expect(isSddImageRelativePath('.dagongsdd/img/wireframe.png')).toBe(false)
    expect(isSddImageRelativePath('img/wireframe.png')).toBe(false)

    expect(isSddPrototypeRelativePath(`.dagongsdd/requirements/${UUID}/proto/p.html`)).toBe(true)
    expect(isSddPrototypeRelativePath('.dagongsdd/proto/p.html')).toBe(false)
    expect(isSddPrototypeRelativePath(`.dagongsdd/requirements/${UUID}/img/p.html`)).toBe(false)
  })
})
