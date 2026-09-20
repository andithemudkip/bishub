import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  Hymn,
  HymnBlockKind,
  HymnCommitResult,
  PptxImportResult,
  PptxParseReason,
} from "../../../shared/types";
import {
  buildDraft,
  draftToHymn,
  titleFromSlideText,
  type DraftFlag,
  type HymnImportDraft,
} from "../../../shared/hymnImport";
import { getTranslations, type Language } from "../../../shared/i18n";
import { StatusBanner } from "../ui/Card";
import {
  CheckIcon,
  CloseIcon,
  PencilIcon,
  RepeatIcon,
  WarningIcon,
} from "../icons/ui";

/**
 * The import review screen.
 *
 * Shown once per chosen file, as a queue. It is deliberately **slide-centric**:
 * the list mirrors the deck the user recognises from PowerPoint, one row per
 * slide, and the deduplicated verses the app actually stores are shown as
 * annotations on those rows rather than as the primary structure.
 *
 * Nothing the heuristics decided is hidden. A slide we left out still appears,
 * unticked, saying why, one tap from coming back — because a wrongly dropped
 * verse that the user never saw is the worst outcome this screen can produce.
 */

interface Props {
  results: PptxImportResult[];
  language: Language;
  /** Display name of the destination book, for the save button. */
  bookName: string;
  /** Numbers already used in that book, so the prefill avoids them. */
  existingNumbers: string[];
  onCommit: (hymn: Hymn, fileName: string) => Promise<HymnCommitResult>;
  onClose: () => void;
  /** Offered at the end, to go and look at what was saved. */
  onOpenBook: () => void;
}

interface Outcome {
  fileName: string;
  title: string;
  /** The number it ended up with, which may not be the one requested. */
  number: string;
  renumberedFrom?: string;
}

/** Smallest positive integer not already used, as a string. */
function nextFreeNumber(taken: ReadonlySet<string>): string {
  let next = 1;
  while (taken.has(String(next))) next++;
  return String(next);
}

export default function HymnImportFlow({
  results,
  language,
  bookName,
  existingNumbers,
  onCommit,
  onClose,
  onOpenBook,
}: Props) {
  const all = getTranslations(language);
  const t = all.hymnImport;
  // Verse/chorus wording is shared with the hymn list rather than duplicated —
  // the same hymn must not be "3 strofe" in one place and "3 versete" in another.
  const words = all.hymns;

  const [cursor, setCursor] = useState(0);
  const [saved, setSaved] = useState<Outcome[]>([]);
  const [taken, setTaken] = useState<Set<string>>(() => new Set(existingNumbers));
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Per-deck review state. Cleared whenever the queue advances — keeping it
  // would carry one deck's corrections onto the next.
  const [excluded, setExcluded] = useState<ReadonlySet<number>>(new Set());
  const [included, setIncluded] = useState<ReadonlySet<number>>(new Set());
  const [kindOverrides, setKindOverrides] = useState<ReadonlyMap<string, HymnBlockKind>>(new Map());
  const [textOverrides, setTextOverrides] = useState<ReadonlyMap<string, string>>(new Map());
  const [titleEdit, setTitleEdit] = useState<string | null>(null);
  const [numberEdit, setNumberEdit] = useState<string | null>(null);
  // Keyed by row — "<slide>:<stanza>" — not by block. A block can be on screen
  // four times over; keying by block turned every one of them into a textarea at
  // once and autofocused the last, scrolling the user away from the row they
  // tapped. The edit still applies to the block; only one row hosts it.
  // Near-duplicate stanzas are joined by default and the notice says so, with
  // one tap to undo. The detector only fires on blocks that are identical once
  // accents and punctuation are stripped, so it cannot fuse two genuinely
  // different stanzas — and leaving them apart is what produced four
  // identical-looking choruses cross-referencing each other.
  const [merge, setMerge] = useState(true);
  const [editingRow, setEditingRow] = useState<string | null>(null);
  const [kindMenuRow, setKindMenuRow] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);

  const resetDeckState = useCallback(() => {
    setExcluded(new Set());
    setIncluded(new Set());
    setKindOverrides(new Map());
    setTextOverrides(new Map());
    setTitleEdit(null);
    setNumberEdit(null);
    setMerge(true);
    setEditingRow(null);
    setKindMenuRow(null);
    setSaveError(null);
    scrollRef.current?.scrollTo({ top: 0 });
  }, []);

  const advance = useCallback(() => {
    resetDeckState();
    setCursor((c) => c + 1);
  }, [resetDeckState]);

  const current = results[cursor];
  const finished = cursor >= results.length;

  // Escape is the expected way out of a full-screen task on desktop.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const nextNumber = useMemo(() => nextFreeNumber(taken), [taken]);

  const draft: HymnImportDraft | null = useMemo(() => {
    if (!current?.ok) return null;
    return buildDraft(current.deck, {
      fileName: current.fileName,
      nextNumber,
      excluded,
      included,
      kindOverrides,
      textOverrides,
      title: titleEdit ?? undefined,
      number: numberEdit ?? undefined,
      mergeNearDuplicates: merge,
    });
  }, [current, nextNumber, excluded, included, kindOverrides, textOverrides, titleEdit, numberEdit, merge]);

  /**
   * Which slides carry the near-duplicate stanzas, for the notice.
   *
   * Only the *unmerged* draft can answer this — once merged, the groups are one
   * block and the flag carries a count rather than the members. It is a second
   * pass over a deck of a few dozen slides, which is nothing.
   */
  const duplicateSlides: number[] = useMemo(() => {
    if (!current?.ok) return [];
    const plain = buildDraft(current.deck, {
      fileName: current.fileName,
      nextNumber,
      excluded,
      included,
    });
    const flag = plain.flags.find((f) => f.code === "near-duplicate-blocks");
    if (!flag?.detail) return [];
    const grouped = new Set(
      flag.detail.split(",").flatMap((group) => group.split("+").map(Number))
    );
    const slides: number[] = [];
    plain.slides.forEach((slide, position) => {
      if (slide.blockIndices.some((index) => grouped.has(index))) slides.push(position + 1);
    });
    return slides;
  }, [current, nextNumber, excluded, included]);

  // ── the queue ──────────────────────────────────────────────────────────────

  if (finished) {
    return (
      <Shell onClose={onClose} title={t.doneHeading} language={language}>
        <div className="p-4 space-y-4">
          {saved.length === 0 ? (
            <p className="text-gray-300">{t.savedNone}</p>
          ) : (
            <>
              <p className="text-gray-100 font-medium">
                {t.savedCount
                  .replace("{count}", String(saved.length))
                  .replace("{book}", bookName)}
              </p>
              <ul className="space-y-1.5">
                {saved.map((outcome) => (
                  <li
                    key={`${outcome.fileName}:${outcome.number}`}
                    className="bg-gray-900/50 border border-gray-700/30 rounded-lg px-3 py-2 text-sm"
                  >
                    <span className="font-mono text-blue-400 mr-2">{outcome.number}</span>
                    <span className="text-gray-200">{outcome.title}</span>
                    {outcome.renumberedFrom && (
                      <div className="text-xs text-gray-400 mt-1">
                        {t.savedRenumbered
                          .replace("{title}", outcome.title)
                          .replace("{number}", outcome.number)}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
        <Footer>
          {saved.length > 0 && (
            <button
              type="button"
              onClick={onOpenBook}
              className="flex-1 px-4 py-3 rounded-xl text-sm font-medium bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 border border-blue-600/40 focus-visible:ring-2 focus-visible:ring-blue-500 focus:outline-none"
            >
              {t.viewBook.replace("{book}", bookName)}
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-3 rounded-xl text-sm font-medium bg-gray-700/50 text-gray-200 hover:bg-gray-700 border border-gray-600/40 focus-visible:ring-2 focus-visible:ring-blue-500 focus:outline-none"
          >
            {t.finish}
          </button>
        </Footer>
      </Shell>
    );
  }

  const position =
    results.length > 1
      ? t.queuePosition
          .replace("{current}", String(cursor + 1))
          .replace("{total}", String(results.length))
      : "";

  // ── a file we could not read ───────────────────────────────────────────────

  if (!current.ok) {
    return (
      <Shell onClose={onClose} title={t.cannotImport} subtitle={position} language={language}>
        <div className="p-4 space-y-4">
          <div className="text-sm text-gray-400 break-words">{current.fileName}</div>
          <StatusBanner color="yellow">
            <div className="flex gap-3">
              <WarningIcon className="w-5 h-5 flex-shrink-0 text-yellow-400 mt-0.5" />
              <p className="text-sm leading-relaxed text-yellow-100/90">
                {reasonMessage(current.reason, t)}
              </p>
            </div>
          </StatusBanner>
        </div>
        <Footer>
          <button
            type="button"
            onClick={advance}
            className="flex-1 px-4 py-3 rounded-xl text-sm font-medium bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 border border-blue-600/40 focus-visible:ring-2 focus-visible:ring-blue-500 focus:outline-none"
          >
            {cursor + 1 < results.length ? t.skipFile : t.finish}
          </button>
        </Footer>
      </Shell>
    );
  }

  // ── review ─────────────────────────────────────────────────────────────────

  const deck = draft!;
  const hymn = draftToHymn(deck);
  const includedSlides = deck.slides.filter((slide) => slide.included).length;
  const verseCount = deck.blocks.filter((block) => block.kind === "verse").length;
  const hasChorus = deck.blocks.some((block) => block.kind === "chorus");

  const blockedReason = !includedSlides
    ? t.nothingSelected
    : !deck.title.trim()
      ? t.needTitle
      : null;

  /** The slide each block first appears on, for the "same as slide N" badge. */
  const firstSlideOfBlock = new Map<number, number>();
  deck.slides.forEach((slide, position) => {
    for (const blockIndex of slide.blockIndices) {
      if (!firstSlideOfBlock.has(blockIndex)) firstSlideOfBlock.set(blockIndex, position + 1);
    }
  });

  const toggleSlide = (index: number, wasIncluded: boolean) => {
    setEditingRow(null);
    setKindMenuRow(null);
    if (wasIncluded) {
      setExcluded((prev) => new Set(prev).add(index));
      setIncluded((prev) => {
        const next = new Set(prev);
        next.delete(index);
        return next;
      });
    } else {
      setIncluded((prev) => new Set(prev).add(index));
      setExcluded((prev) => {
        const next = new Set(prev);
        next.delete(index);
        return next;
      });
    }
  };

  const setKind = (blockIndex: number, kind: HymnBlockKind) => {
    const key = deck.blockKeys[blockIndex];
    setKindOverrides((prev) => new Map(prev).set(key, kind));
    setKindMenuRow(null);
  };

  const setText = (blockIndex: number, text: string) => {
    const key = deck.blockKeys[blockIndex];
    setTextOverrides((prev) => new Map(prev).set(key, text));
  };

  const save = async () => {
    if (!hymn || saving) return;
    setSaving(true);
    setSaveError(null);
    const requested = hymn.number;
    const result = await onCommit(hymn, current.fileName);
    setSaving(false);
    if (!result.ok) {
      setSaveError(
        result.reason === "invalid-hymn" ? t.errorInvalidHymn : t.errorSaveFailed
      );
      return;
    }
    setTaken((prev) => new Set(prev).add(result.hymn.number));
    setSaved((prev) => [
      ...prev,
      {
        fileName: current.fileName,
        title: result.hymn.title,
        number: result.hymn.number,
        renumberedFrom: result.hymn.number === requested ? undefined : requested,
      },
    ]);
    advance();
  };

  return (
    <Shell
      onClose={onClose}
      title={t.reviewHeading}
      subtitle={position}
      language={language}
      onSkip={results.length > 1 ? advance : undefined}
      skipLabel={t.skipFile}
      scrollRef={scrollRef}
    >
      <div className="p-4 space-y-4">
        <div className="text-xs text-gray-500 break-words">{current.fileName}</div>

        {/* Anything the heuristics were unsure about, said plainly. */}
        {deck.flags.length > 0 && <Warnings flags={deck.flags} t={t} />}

        {duplicateSlides.length > 0 && (
          <MergeNotice
            t={t}
            slides={duplicateSlides}
            merged={merge}
            onToggle={() => {
              setMerge((value) => !value);
              setEditingRow(null);
              setKindMenuRow(null);
            }}
          />
        )}

        {/* Title and number. Prefilled guesses, always overridable. */}
        <div className="space-y-3">
          <label className="block">
            <span className="block text-xs font-medium text-gray-400 mb-1.5">
              {t.titleLabel}
            </span>
            <input
              type="text"
              value={deck.title}
              onChange={(event) => setTitleEdit(event.target.value)}
              placeholder={t.titlePlaceholder}
              className="w-full px-3 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white text-base placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </label>

          <label className="block w-32">
            <span className="block text-xs font-medium text-gray-400 mb-1.5">
              {t.numberLabel}
            </span>
            <input
              type="text"
              inputMode="numeric"
              value={deck.number}
              onChange={(event) => setNumberEdit(event.target.value.replace(/[^\d]/g, ""))}
              className="w-full px-3 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white text-base font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </label>
          {taken.has(deck.number) && (
            <p className="text-xs text-yellow-400/90">
              {t.numberTaken.replace("{number}", deck.number)}
            </p>
          )}
        </div>

        {/* What will actually be saved, recomputed on every tick. */}
        <div className="bg-gray-900/50 border border-gray-700/50 rounded-lg px-3 py-2.5 text-sm text-gray-300">
          {includedSlides === 0 ? (
            <span className="text-yellow-400/90">{t.nothingSelected}</span>
          ) : (
            <>
              {verseCount} {verseCount === 1 ? words.verse : words.verses}
              {hasChorus && ` + ${words.chorus}`}
              <span className="text-gray-500">
                {" · "}
                {t.summarySlides.replace("{count}", String(includedSlides))}
              </span>
            </>
          )}
        </div>

        <div>
          <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">
            {t.slidesHeading}
          </h3>
          <ul className="space-y-2">
            {deck.slides.map((slide) => {
              const number = slide.index + 1;
              return (
                <li
                  key={slide.index}
                  className={`rounded-lg border transition-colors ${
                    slide.included
                      ? "bg-gray-900/50 border-gray-700/40"
                      : "bg-gray-900/30 border-gray-800"
                  }`}
                >
                  <div className="flex gap-2 p-2">
                    {/* 44px target: this is the control that decides what the
                        congregation sees, and it is used on a phone. */}
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={slide.included}
                      aria-label={`${t.slideLabel.replace("{n}", String(number))} — ${
                        slide.included ? t.includeLabel : t.excludedLabel
                      }`}
                      onClick={() => toggleSlide(slide.index, slide.included)}
                      className="flex-shrink-0 w-11 h-11 flex items-center justify-center rounded-lg hover:bg-gray-700/40 focus-visible:ring-2 focus-visible:ring-blue-500 focus:outline-none"
                    >
                      <span
                        className={`w-6 h-6 rounded-md border-2 flex items-center justify-center transition-colors ${
                          slide.included
                            ? "bg-blue-600/30 border-blue-500 text-blue-300"
                            : "border-gray-600 text-transparent"
                        }`}
                      >
                        <CheckIcon className="w-4 h-4" />
                      </span>
                    </button>

                    <div className="flex-1 min-w-0 py-1.5 pr-1">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="text-[11px] font-medium text-gray-500">
                          {t.slideLabel.replace("{n}", String(number))}
                        </span>
                        {!slide.included && (
                          <span className="text-[11px] px-1.5 py-0.5 rounded bg-gray-800 text-gray-400">
                            {slide.autoExcluded === "title-slide"
                              ? t.reasonTitleSlide
                              : slide.autoExcluded === "empty"
                                ? t.reasonEmpty
                                : t.excludedLabel}
                          </span>
                        )}
                      </div>

                      {slide.included ? (
                        slide.blockIndices.map((blockIndex, occurrence) => {
                          const block = deck.blocks[blockIndex];
                          const firstSlide = firstSlideOfBlock.get(blockIndex) ?? number;
                          const isRepeat = firstSlide !== number;
                          const row = `${slide.index}:${occurrence}`;
                          return (
                            <Stanza
                              key={row}
                              t={t}
                              text={block.text}
                              kind={block.kind}
                              isRepeat={isRepeat}
                              firstSlide={firstSlide}
                              editing={editingRow === row}
                              kindMenuOpen={kindMenuRow === row}
                              onEdit={() => {
                                setEditingRow(row);
                                setKindMenuRow(null);
                              }}
                              onEditDone={() => setEditingRow(null)}
                              onTextChange={(text) => setText(blockIndex, text)}
                              onToggleKindMenu={() =>
                                setKindMenuRow(kindMenuRow === row ? null : row)
                              }
                              onKind={(kind) => setKind(blockIndex, kind)}
                            />
                          );
                        })
                      ) : (
                        <>
                          <p className="text-sm text-gray-500 whitespace-pre-line break-words line-clamp-6">
                            {slide.text || t.noWords}
                          </p>
                          {slide.autoExcluded === "title-slide" && slide.text && (
                            <button
                              type="button"
                              onClick={() => setTitleEdit(titleFromSlideText(slide.text))}
                              className="mt-2 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-gray-700/40 text-gray-300 hover:bg-gray-700 border border-gray-600/40 focus-visible:ring-2 focus-visible:ring-blue-500 focus:outline-none"
                            >
                              {t.useAsTitle}
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      <Footer>
        {saveError && (
          <p className="w-full text-sm text-red-400 mb-2" role="alert">
            {saveError}
          </p>
        )}
        {blockedReason && (
          <p className="w-full text-sm text-yellow-400/90 mb-2">{blockedReason}</p>
        )}
        <button
          type="button"
          onClick={save}
          disabled={!hymn || saving}
          className="w-full px-4 py-3.5 rounded-xl text-base font-medium bg-blue-600/20 text-blue-300 hover:bg-blue-600/30 border border-blue-600/40 disabled:opacity-40 disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-blue-500 focus:outline-none"
        >
          {saving ? t.saving : t.save.replace("{book}", bookName)}
        </button>
      </Footer>
    </Shell>
  );
}

// ── pieces ───────────────────────────────────────────────────────────────────

interface StanzaProps {
  t: ReturnType<typeof getTranslations>["hymnImport"];
  text: string;
  kind: HymnBlockKind;
  isRepeat: boolean;
  firstSlide: number;
  editing: boolean;
  kindMenuOpen: boolean;
  onEdit: () => void;
  onEditDone: () => void;
  onTextChange: (text: string) => void;
  onToggleKindMenu: () => void;
  onKind: (kind: HymnBlockKind) => void;
}

const KINDS: HymnBlockKind[] = ["verse", "chorus", "bridge"];

function Stanza({
  t,
  text,
  kind,
  isRepeat,
  firstSlide,
  editing,
  kindMenuOpen,
  onEdit,
  onEditDone,
  onTextChange,
  onToggleKindMenu,
  onKind,
}: StanzaProps) {
  const kindLabel = (value: HymnBlockKind) =>
    value === "chorus" ? t.kindChorus : value === "bridge" ? t.kindBridge : t.kindVerse;

  return (
    <div className="mt-1 first:mt-0">
      <div className="flex items-center gap-1.5 flex-wrap mb-1">
        {isRepeat ? (
          // A repeat is not separately taggable or editable-in-isolation: it is
          // the same stanza coming round again, and saying so is what stops the
          // user wondering why their edit appeared twice.
          <span className="inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded bg-blue-950/50 text-blue-300/90 border border-blue-800/40">
            <RepeatIcon className="w-3 h-3" />
            {t.sameAsSlide.replace("{n}", String(firstSlide))}
          </span>
        ) : (
          <button
            type="button"
            onClick={onToggleKindMenu}
            aria-expanded={kindMenuOpen}
            aria-label={t.changeKind}
            className="text-[11px] px-2 py-1 rounded bg-gray-800 text-gray-300 hover:bg-gray-700 border border-gray-700 focus-visible:ring-2 focus-visible:ring-blue-500 focus:outline-none"
          >
            {kindLabel(kind)}
          </button>
        )}
        {!isRepeat && !editing && (
          <button
            type="button"
            onClick={onEdit}
            className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded text-gray-400 hover:text-gray-200 hover:bg-gray-700/50 focus-visible:ring-2 focus-visible:ring-blue-500 focus:outline-none"
          >
            <PencilIcon className="w-3 h-3" />
            {t.editWords}
          </button>
        )}
      </div>

      {kindMenuOpen && !isRepeat && (
        <div className="flex gap-1 mb-1.5 bg-gray-900/50 border border-gray-700/50 rounded-lg p-1 w-fit">
          {KINDS.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => onKind(value)}
              aria-pressed={kind === value}
              className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-blue-500 focus:outline-none ${
                kind === value
                  ? "bg-blue-600/20 text-blue-400 border border-blue-600/40"
                  : "text-gray-400 hover:text-white hover:bg-gray-700/50 border border-transparent"
              }`}
            >
              {kindLabel(value)}
            </button>
          ))}
        </div>
      )}

      {editing ? (
        <div>
          <textarea
            autoFocus
            value={text}
            onChange={(event) => onTextChange(event.target.value)}
            rows={Math.min(10, text.split("\n").length + 1)}
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <div className="flex items-center gap-2 mt-1.5">
            <button
              type="button"
              onClick={onEditDone}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 border border-blue-600/40 focus-visible:ring-2 focus-visible:ring-blue-500 focus:outline-none"
            >
              {t.doneEditing}
            </button>
            <span className="text-[11px] text-gray-500">{t.sameAsSlideHint}</span>
          </div>
        </div>
      ) : (
        <p
          className={`text-sm whitespace-pre-line break-words leading-relaxed ${
            isRepeat ? "text-gray-500" : "text-gray-200"
          }`}
        >
          {text}
        </p>
      )}
    </div>
  );
}

/**
 * The one case where the app cannot just report and move on.
 *
 * A chorus retyped on each slide drifts — `Se-arată zorii` has it four times,
 * two of them missing an accent — and exact dedupe then yields two chorus
 * blocks that look identical on screen and cross-reference each other's slide
 * numbers. Joining them is the right answer often enough to be the default, but
 * it changes the user's own words, so it says what it did and offers the way
 * back in the same breath.
 */
function MergeNotice({
  t,
  slides,
  merged,
  onToggle,
}: {
  t: ReturnType<typeof getTranslations>["hymnImport"];
  slides: number[];
  merged: boolean;
  onToggle: () => void;
}) {
  // "2, 4, 6 și 8". Intl.ListFormat would do this, but it is ES2021 and the
  // project targets ES2020 — not worth widening the lib for one string.
  const list =
    slides.length > 1
      ? `${slides.slice(0, -1).join(", ")} ${t.listAnd} ${slides[slides.length - 1]}`
      : String(slides[0] ?? "");

  return (
    <StatusBanner color={merged ? "blue" : "yellow"}>
      <div className="flex gap-3">
        <WarningIcon
          className={`w-5 h-5 flex-shrink-0 mt-0.5 ${merged ? "text-blue-400" : "text-yellow-400"}`}
        />
        <div className="min-w-0">
          <p
            className={`text-sm leading-relaxed ${merged ? "text-blue-100/90" : "text-yellow-100/90"}`}
          >
            {(merged ? t.mergedNotice : t.mergeOffer).replace("{slides}", list)}
          </p>
          <button
            type="button"
            onClick={onToggle}
            className={`mt-2 px-3 py-1.5 rounded-lg text-xs font-medium border focus-visible:ring-2 focus-visible:ring-blue-500 focus:outline-none ${
              merged
                ? "bg-gray-700/40 text-gray-200 hover:bg-gray-700 border-gray-600/40"
                : "bg-blue-600/20 text-blue-300 hover:bg-blue-600/30 border-blue-600/40"
            }`}
          >
            {merged ? t.mergeUndo : t.mergeAction}
          </button>
        </div>
      </div>
    </StatusBanner>
  );
}

function Warnings({
  flags,
  t,
}: {
  flags: DraftFlag[];
  t: ReturnType<typeof getTranslations>["hymnImport"];
}) {
  const messages = flags
    .map((flag) => flagMessage(flag, t))
    .filter((message): message is string => !!message);
  if (messages.length === 0) return null;

  return (
    <StatusBanner color="yellow">
      <div className="flex gap-3">
        <WarningIcon className="w-5 h-5 flex-shrink-0 text-yellow-400 mt-0.5" />
        <ul className="space-y-1 text-sm text-yellow-100/90 leading-relaxed">
          {messages.map((message) => (
            <li key={message}>{message}</li>
          ))}
        </ul>
      </div>
    </StatusBanner>
  );
}

/**
 * Not every flag is worth a warning. `dropped-furniture` and
 * `no-included-slides` are already visible in the list and the summary line, and
 * repeating them here would train the user to ignore the banner.
 */
function flagMessage(
  flag: DraftFlag,
  t: ReturnType<typeof getTranslations>["hymnImport"]
): string | null {
  switch (flag.code) {
    case "single-slide":
      return t.warnSingleSlide;
    case "all-slides-identical":
      return t.warnAllIdentical;
    case "many-slides":
      return t.warnManySlides.replace("{count}", flag.detail ?? "");
    case "foreign-number":
      return t.warnForeignNumber.replace("{number}", flag.detail ?? "");
    case "empty-slides":
      return t.warnEmptySlides.replace("{count}", flag.detail ?? "");
    default:
      return null;
  }
}

function reasonMessage(
  reason: PptxParseReason,
  t: ReturnType<typeof getTranslations>["hymnImport"]
): string {
  switch (reason) {
    case "legacy-ppt":
      return t.errorLegacyPpt;
    case "no-text-found":
      return t.errorNoTextFound;
    case "too-large":
      return t.errorTooLarge;
    case "unreadable":
      return t.errorUnreadable;
    default:
      return t.errorNotAPptx;
  }
}

// ── chrome ───────────────────────────────────────────────────────────────────

function Shell({
  children,
  onClose,
  title,
  subtitle,
  language,
  onSkip,
  skipLabel,
  scrollRef,
}: {
  children: React.ReactNode;
  onClose: () => void;
  title: string;
  subtitle?: string;
  language: Language;
  onSkip?: () => void;
  skipLabel?: string;
  scrollRef?: React.Ref<HTMLDivElement>;
}) {
  const t = getTranslations(language).hymnImport;
  const dialogRef = useRef<HTMLDivElement>(null);

  // Without this, focus stays on the button behind the overlay: a keyboard user
  // would tab through the page they can no longer see.
  useEffect(() => {
    dialogRef.current?.focus();
  }, []);

  return (
    <div
      ref={dialogRef}
      tabIndex={-1}
      className="fixed inset-0 z-50 bg-gray-900 flex flex-col safe-area-pt focus:outline-none"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <header className="flex-shrink-0 flex items-center gap-2 px-3 py-2.5 border-b border-gray-800">
        <button
          type="button"
          onClick={onClose}
          className="flex items-center gap-1.5 px-2 py-2 -ml-1 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-gray-800 focus-visible:ring-2 focus-visible:ring-blue-500 focus:outline-none"
        >
          <CloseIcon className="w-4 h-4" />
          <span className="hidden sm:inline">{t.close}</span>
        </button>
        <div className="flex-1 min-w-0 text-center">
          <div className="text-sm font-medium truncate">{title}</div>
          {subtitle && <div className="text-[11px] text-gray-500">{subtitle}</div>}
        </div>
        {onSkip ? (
          <button
            type="button"
            onClick={onSkip}
            className="px-3 py-2 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-gray-800 focus-visible:ring-2 focus-visible:ring-blue-500 focus:outline-none"
          >
            {skipLabel}
          </button>
        ) : (
          // Keeps the title centred without a second layout pass.
          <span className="w-8 sm:w-16" aria-hidden />
        )}
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto overscroll-contain min-h-0">
        <div className="max-w-2xl mx-auto w-full">{children}</div>
      </div>
    </div>
  );
}

function Footer({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex-shrink-0 border-t border-gray-800 bg-gray-900 safe-area-pb">
      <div className="max-w-2xl mx-auto w-full px-4 py-3 flex flex-wrap items-center gap-2">
        {children}
      </div>
    </div>
  );
}
