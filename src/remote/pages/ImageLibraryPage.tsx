import { useState, useMemo } from "react";
import type { AppSettings, ImageState } from "../../shared/types";
import type { ImageItem } from "../../shared/imageLibrary.types";
import { IMAGE_EXTENSIONS } from "../../shared/imageLibrary.types";
import { useImageLibrary } from "../useImageLibrary";
import MediaUploader from "../components/MediaUploader";
import { getTranslations } from "@shared/i18n";
import { normalizeForSearch, getApiUrl, formatFileSize } from "@shared/utils";
import { Card } from "../components/ui/Card";
import { renderTip } from "../components/ui/renderTip";
import {
  ChevronLeftIcon,
  CloseIcon,
} from "../components/icons/ui";

interface Props {
  imageState: ImageState;
  loadImage: (src: string, imageId: string) => void;
  loadSlideshow: (slideshowId: string) => void;
  setImageAutoAdvance: (enabled: boolean) => void;
  setImageFit: (fit: "fill" | "fit") => void;
  setImageLoop: (loop: boolean) => void;
  setImageAutoAdvanceInterval: (intervalMs: number) => void;
  settings: AppSettings;
}

type View =
  | { type: "grid" }
  | { type: "slideshow"; slideshowId: string }
  | { type: "addToSlideshow"; slideshowId: string };

export default function ImageLibraryPage({
  imageState,
  loadImage,
  loadSlideshow,
  setImageAutoAdvance,
  setImageFit,
  setImageLoop,
  setImageAutoAdvanceInterval,
  settings,
}: Props) {
  const library = useImageLibrary(loadImage, loadSlideshow);
  const [view, setView] = useState<View>({ type: "grid" });
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectMode, setSelectMode] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [slideshowNamePrompt, setSlideshowNamePrompt] = useState(false);
  const [newSlideshowName, setNewSlideshowName] = useState("");
  const [multiUploadPrompt, setMultiUploadPrompt] = useState<ImageItem[] | null>(null);
  const [editingSlideshowName, setEditingSlideshowName] = useState(false);
  const [slideshowNameValue, setSlideshowNameValue] = useState("");

  const t = getTranslations(settings.language);

  const ungroupedImages = useMemo(
    () => library.images.filter((i) => !i.slideshowId),
    [library.images]
  );

  const filteredUngrouped = useMemo(() => {
    if (!search) return ungroupedImages;
    const norm = normalizeForSearch(search);
    return ungroupedImages.filter((i) =>
      normalizeForSearch(i.name).includes(norm)
    );
  }, [ungroupedImages, search]);

  const filteredSlideshows = useMemo(() => {
    if (!search) return library.slideshows;
    const norm = normalizeForSearch(search);
    return library.slideshows.filter((s) =>
      normalizeForSearch(s.name).includes(norm)
    );
  }, [library.slideshows, search]);

  const slideshowInfo = useMemo(() => {
    const map = new Map<string, { first: ImageItem | null; count: number }>();
    for (const s of library.slideshows) {
      map.set(s.id, { first: null, count: 0 });
    }
    for (const img of library.images) {
      if (!img.slideshowId) continue;
      const info = map.get(img.slideshowId);
      if (!info) continue;
      info.count++;
      if (!info.first || (img.slideshowOrder ?? 0) < (info.first.slideshowOrder ?? 0)) {
        info.first = img;
      }
    }
    return map;
  }, [library.images, library.slideshows]);

  // Update slideshow settings, pushing changes to the live presentation if active
  const updateSlideshowLive = (
    slideshowId: string,
    updates: Parameters<typeof library.updateSlideshow>[1]
  ) => {
    library.updateSlideshow(slideshowId, updates);
    if (imageState.slideshowId === slideshowId) {
      if (updates.fit !== undefined) setImageFit(updates.fit);
      if (updates.autoAdvance !== undefined) setImageAutoAdvance(updates.autoAdvance);
      if (updates.loop !== undefined) setImageLoop(updates.loop);
      if (updates.autoAdvanceInterval !== undefined) setImageAutoAdvanceInterval(updates.autoAdvanceInterval);
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleCreateSlideshow = () => {
    if (newSlideshowName.trim() && selectedIds.size > 0) {
      library.createSlideshow(newSlideshowName.trim(), [...selectedIds]);
      setSelectedIds(new Set());
      setSelectMode(false);
      setSlideshowNamePrompt(false);
      setNewSlideshowName("");
    }
  };

  const handleMultiUploadAsSlideshow = () => {
    if (!multiUploadPrompt || multiUploadPrompt.length === 0) return;
    setMultiUploadPrompt(null);
    setSelectedIds(new Set(multiUploadPrompt.map((i) => i.id)));
    setSelectMode(true);
    setSlideshowNamePrompt(true);
  };

  const handleAddLocalImages = async () => {
    const images = await library.addLocalImages();
    if (images && images.length > 1) {
      setMultiUploadPrompt(images);
    }
  };

  const handleDelete = async (imageId: string) => {
    await library.deleteImage(imageId);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.delete(imageId);
      return next;
    });
  };

  const handleDeleteSelected = async () => {
    for (const id of selectedIds) {
      await library.deleteImage(id);
    }
    setSelectedIds(new Set());
    setSelectMode(false);
    setConfirmBulkDelete(false);
  };

  const startRename = (image: ImageItem) => {
    setRenamingId(image.id);
    setRenameValue(image.name);
  };

  const commitRename = () => {
    if (renamingId && renameValue.trim()) {
      library.renameImage(renamingId, renameValue.trim());
    }
    setRenamingId(null);
  };

  const getImageThumbnailUrl = (image: ImageItem): string | null => {
    if (!image.thumbnailPath) return null;
    return getApiUrl(`/api/images/thumbnail/${image.id}`);
  };

  // Slideshow detail view
  if (view.type === "slideshow") {
    const slideshow = library.slideshows.find(
      (s) => s.id === view.slideshowId
    );
    if (!slideshow) {
      setView({ type: "grid" });
      return null;
    }

    const slideshowImages = library.images
      .filter((i) => i.slideshowId === slideshow.id)
      .sort((a, b) => (a.slideshowOrder ?? 0) - (b.slideshowOrder ?? 0));

    // When this slideshow is live, use imageState as source of truth for settings
    const isLive = imageState.slideshowId === slideshow.id;
    const effectiveSettings = {
      fit: isLive ? imageState.fit : slideshow.fit,
      autoAdvance: isLive ? imageState.autoAdvance : slideshow.autoAdvance,
      autoAdvanceInterval: isLive ? imageState.autoAdvanceInterval : slideshow.autoAdvanceInterval,
      loop: isLive ? imageState.loop : slideshow.loop,
    };

    const handleMoveUp = (index: number) => {
      if (index === 0) return;
      const ordered = slideshowImages.map((i) => i.id);
      [ordered[index - 1], ordered[index]] = [
        ordered[index],
        ordered[index - 1],
      ];
      library.reorderSlideshowImages(slideshow.id, ordered);
    };

    const handleMoveDown = (index: number) => {
      if (index >= slideshowImages.length - 1) return;
      const ordered = slideshowImages.map((i) => i.id);
      [ordered[index], ordered[index + 1]] = [
        ordered[index + 1],
        ordered[index],
      ];
      library.reorderSlideshowImages(slideshow.id, ordered);
    };

    return (
      <div className="min-w-0 w-full min-h-full flex flex-col">
        <div className="max-w-2xl mx-auto w-full space-y-4 sm:space-y-6 mb-4">
          {/* Header */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setView({ type: "grid" })}
              className="p-2 rounded-lg hover:bg-gray-800 transition-colors"
            >
              <ChevronLeftIcon className="w-5 h-5" />
            </button>
            {editingSlideshowName ? (
              <input
                autoFocus
                value={slideshowNameValue}
                onChange={(e) => setSlideshowNameValue(e.target.value)}
                onBlur={() => {
                  if (slideshowNameValue.trim()) {
                    library.updateSlideshow(slideshow.id, {
                      name: slideshowNameValue.trim(),
                    });
                  }
                  setEditingSlideshowName(false);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    (e.target as HTMLInputElement).blur();
                  }
                }}
                className="text-lg font-semibold bg-gray-800 border border-gray-700 rounded-lg px-3 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500 flex-1"
              />
            ) : (
              <h2
                className="text-lg font-semibold cursor-pointer hover:text-blue-400 transition-colors"
                onClick={() => {
                  setSlideshowNameValue(slideshow.name);
                  setEditingSlideshowName(true);
                }}
              >
                {slideshow.name}
              </h2>
            )}
            <span className="text-sm text-gray-500">
              {t.imageLibrary.imagesCount.replace(
                "{count}",
                String(slideshowImages.length)
              )}
            </span>
          </div>

          {/* Settings */}
          <Card compact>
            <div className="flex flex-wrap gap-4">
              {/* Fit */}
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-400">
                  {t.imageLibrary.fit}:
                </span>
                <div className="flex items-center bg-gray-900/50 border border-gray-700/50 rounded-lg overflow-hidden">
                  <button
                    onClick={() =>
                      updateSlideshowLive(slideshow.id, { fit: "fill" })
                    }
                    className={`px-3 py-1.5 text-sm transition-colors ${
                      effectiveSettings.fit === "fill"
                        ? "bg-blue-600/20 text-blue-400"
                        : "text-gray-400 hover:bg-gray-700"
                    }`}
                  >
                    {t.imageLibrary.fitFill}
                  </button>
                  <button
                    onClick={() =>
                      updateSlideshowLive(slideshow.id, { fit: "fit" })
                    }
                    className={`px-3 py-1.5 text-sm transition-colors ${
                      effectiveSettings.fit === "fit"
                        ? "bg-blue-600/20 text-blue-400"
                        : "text-gray-400 hover:bg-gray-700"
                    }`}
                  >
                    {t.imageLibrary.fitContain}
                  </button>
                </div>
              </div>

              {/* Auto-advance */}
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={effectiveSettings.autoAdvance}
                  onChange={(e) =>
                    updateSlideshowLive(slideshow.id, {
                      autoAdvance: e.target.checked,
                    })
                  }
                  className="rounded border-gray-600 bg-gray-800 text-blue-500 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-300">
                  {t.imageLibrary.autoAdvance}
                </span>
              </label>

              {/* Interval */}
              {effectiveSettings.autoAdvance && (
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    max={120}
                    value={Math.round(effectiveSettings.autoAdvanceInterval / 1000)}
                    onChange={(e) =>
                      updateSlideshowLive(slideshow.id, {
                        autoAdvanceInterval:
                          Math.max(1, parseInt(e.target.value) || 5) * 1000,
                      })
                    }
                    className="w-16 bg-gray-800 border border-gray-700 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-400">
                    {t.imageLibrary.seconds}
                  </span>
                </div>
              )}

              {/* Loop */}
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={effectiveSettings.loop}
                  onChange={(e) =>
                    updateSlideshowLive(slideshow.id, {
                      loop: e.target.checked,
                    })
                  }
                  className="rounded border-gray-600 bg-gray-800 text-blue-500 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-300">
                  {t.imageLibrary.loop}
                </span>
              </label>
            </div>
          </Card>

          {/* Present button */}
          <button
            onClick={() => library.presentSlideshow(slideshow.id)}
            disabled={slideshowImages.length === 0}
            className="w-full py-3 rounded-lg text-sm font-medium bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 border border-blue-600/40 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {t.imageLibrary.present}
          </button>

          {/* Image list */}
          <Card compact>
            {slideshowImages.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-500 text-sm">{t.imageLibrary.emptySlideshowHint}</p>
              </div>
            ) : (
            <div className="space-y-2">
              {slideshowImages.map((image, index) => (
                <div
                  key={image.id}
                  className="flex items-center gap-3 bg-gray-900/50 border border-gray-700/30 rounded-lg p-2"
                >
                  <div className="w-16 h-10 rounded flex-shrink-0 bg-gray-800 overflow-hidden">
                    {getImageThumbnailUrl(image) && (
                      <img
                        src={getImageThumbnailUrl(image)!}
                        alt={image.name}
                        className="w-full h-full object-cover"
                      />
                    )}
                  </div>
                  <span className="text-sm text-gray-300 flex-1 truncate">
                    {image.name}
                  </span>

                  {/* Reorder buttons */}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => handleMoveUp(index)}
                      disabled={index === 0}
                      className="p-1.5 rounded hover:bg-gray-700 disabled:opacity-30 transition-colors"
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 15l7-7 7 7"
                        />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleMoveDown(index)}
                      disabled={index === slideshowImages.length - 1}
                      className="p-1.5 rounded hover:bg-gray-700 disabled:opacity-30 transition-colors"
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 9l-7 7-7-7"
                        />
                      </svg>
                    </button>
                    {window.electronAPI && (
                      <button
                        onClick={() => window.electronAPI?.showItemInFolder(image.path)}
                        className="p-1.5 rounded hover:bg-gray-700 text-gray-500 hover:text-gray-300 transition-colors"
                        title={t.imageLibrary.openFileLocation}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                        </svg>
                      </button>
                    )}
                    <button
                      onClick={() =>
                        library.removeImageFromSlideshow(image.id)
                      }
                      className="p-1.5 rounded hover:bg-red-600/20 text-gray-500 hover:text-red-400 transition-colors"
                    >
                      <CloseIcon className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
            )}

            {/* Add images button */}
            <button
              onClick={() =>
                setView({ type: "addToSlideshow", slideshowId: slideshow.id })
              }
              className="mt-3 w-full py-2 rounded-lg text-sm bg-gray-800/50 border border-gray-700/50 text-gray-400 hover:text-gray-300 hover:bg-gray-700/50 transition-colors"
            >
              + {t.imageLibrary.addImages}
            </button>
          </Card>

          {/* Delete slideshow */}
          <button
            onClick={() => {
              library.deleteSlideshow(slideshow.id);
              setView({ type: "grid" });
            }}
            className="w-full py-2 rounded-lg text-sm bg-red-600/20 text-red-400 hover:bg-red-600/30 border border-red-600/40 transition-colors"
          >
            {t.imageLibrary.deleteSlideshow}
            <span className="text-red-400/60 ml-2 text-xs">
              ({t.imageLibrary.deleteSlideshowHint})
            </span>
          </button>
        </div>
      </div>
    );
  }

  // Add images to slideshow picker
  if (view.type === "addToSlideshow") {
    const available = ungroupedImages;
    return (
      <div className="min-w-0 w-full min-h-full flex flex-col">
        <div className="max-w-2xl mx-auto w-full space-y-4 mb-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() =>
                setView({ type: "slideshow", slideshowId: view.slideshowId })
              }
              className="p-2 rounded-lg hover:bg-gray-800 transition-colors"
            >
              <ChevronLeftIcon className="w-5 h-5" />
            </button>
            <h2 className="text-lg font-semibold">
              {t.imageLibrary.addImages}
            </h2>
          </div>

          {available.length === 0 ? (
            <p className="text-gray-500 text-sm text-center py-8">
              {t.imageLibrary.noImages}
            </p>
          ) : (
            <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))" }}>
              {available.map((image) => (
                <button
                  key={image.id}
                  onClick={() => {
                    library.addImagesToSlideshow(view.slideshowId, [image.id]);
                  }}
                  className="group bg-gray-900/50 border border-gray-700/30 rounded-lg overflow-hidden hover:border-blue-500/50 transition-colors"
                >
                  <div className="aspect-video bg-gray-800">
                    {getImageThumbnailUrl(image) && (
                      <img
                        src={getImageThumbnailUrl(image)!}
                        alt={image.name}
                        className="w-full h-full object-cover"
                      />
                    )}
                  </div>
                  <div className="p-2">
                    <p className="text-xs text-gray-400 truncate group-hover:text-blue-400">
                      {image.name}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Grid view (default)
  return (
    <div className="min-w-0 w-full min-h-full flex flex-col">
      <div className="max-w-2xl mx-auto w-full space-y-4 sm:space-y-6 mb-4">
        {/* Add images section */}
        <Card compact tip={renderTip(t.imageLibrary.addTip)}>
          <div className="flex items-center bg-gray-900/50 border border-gray-700/50 rounded-lg overflow-hidden mr-8">
            {library.isElectron && (
              <button
                onClick={handleAddLocalImages}
                className="px-3 py-2.5 sm:px-4 hover:bg-gray-700 active:bg-gray-600 transition-colors flex items-center gap-2 text-sm text-gray-300"
              >
                <svg
                  className="w-4 h-4 flex-shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
                <span>{t.imageLibrary.addLocalFiles}</span>
              </button>
            )}
            {!library.isElectron && (
              <span className="px-3 py-2.5 text-sm text-gray-400">
                {t.imageLibrary.upload}
              </span>
            )}
          </div>

          {/* Web upload */}
          {!library.isElectron && (
            <div className="mt-3">
              <MediaUploader
                onUpload={library.uploadImage}
                activeUploads={library.uploads}
                allowedExtensions={IMAGE_EXTENSIONS}
                maxSizeBytes={100 * 1024 * 1024}
                uploadUrl="/api/images/upload"
                uploadFieldName="image"
                labels={{
                  uploading: t.imageLibrary.uploading,
                  uploadDrop: t.imageLibrary.uploadDrop,
                  uploadHint: t.imageLibrary.uploadHint,
                  processing: t.imageLibrary.processing,
                  complete: t.imageLibrary.complete,
                  invalidType: t.imageLibrary.invalidType,
                  tooLarge: t.imageLibrary.tooLarge,
                  uploadFailed: t.imageLibrary.uploadFailed,
                }}
              />
            </div>
          )}
        </Card>

        {/* Multi-upload prompt */}
        {multiUploadPrompt && (
          <Card compact>
            <p className="text-sm text-gray-300 mb-3">
              {t.imageLibrary.multipleImagesPrompt}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setMultiUploadPrompt(null)}
                className="flex-1 py-2 rounded-lg text-sm bg-gray-700/50 text-gray-300 hover:bg-gray-700 border border-gray-600/50 transition-colors"
              >
                {t.imageLibrary.addAsIndividual}
              </button>
              <button
                onClick={handleMultiUploadAsSlideshow}
                className="flex-1 py-2 rounded-lg text-sm bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 border border-blue-600/40 transition-colors"
              >
                {t.imageLibrary.addAsSlideshow}
              </button>
            </div>
          </Card>
        )}

        {/* Slideshow name prompt */}
        {slideshowNamePrompt && (
          <Card compact>
            <p className="text-sm text-gray-300 mb-2">
              {t.imageLibrary.slideshowName}
            </p>
            <div className="flex gap-2">
              <input
                autoFocus
                value={newSlideshowName}
                onChange={(e) => setNewSlideshowName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCreateSlideshow();
                  if (e.key === "Escape") {
                    setSlideshowNamePrompt(false);
                    setNewSlideshowName("");
                  }
                }}
                placeholder={t.imageLibrary.enterName}
                className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={handleCreateSlideshow}
                disabled={!newSlideshowName.trim()}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 border border-blue-600/40 disabled:opacity-40 transition-colors"
              >
                {t.imageLibrary.createSlideshow}
              </button>
              <button
                onClick={() => {
                  setSlideshowNamePrompt(false);
                  setNewSlideshowName("");
                }}
                className="p-2 rounded-lg hover:bg-gray-700 text-gray-500 transition-colors"
              >
                <CloseIcon className="w-4 h-4" />
              </button>
            </div>
          </Card>
        )}

        {/* Image library */}
        <Card compact className="overflow-hidden">
          <h3 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4">
            {t.nav.images} ({library.images.length})
            {library.images.length > 0 && (
              <span className="text-xs sm:text-sm font-normal text-gray-500 ml-2">
                {formatFileSize(library.images.reduce((sum, i) => sum + i.fileSize, 0))}
              </span>
            )}
          </h3>

        {/* Search and select controls */}
        <div className="flex items-center gap-2 mb-4">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t.imageLibrary.searchPlaceholder}
            className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={() => {
              setConfirmDeleteId(null);
              setConfirmBulkDelete(false);
              if (selectMode) {
                setSelectMode(false);
                setSelectedIds(new Set());
              } else {
                setSelectMode(true);
              }
            }}
            className={`px-3 py-2 rounded-lg text-sm border transition-colors ${
              selectMode
                ? "bg-blue-600/20 text-blue-400 border-blue-600/40"
                : "bg-gray-800 text-gray-400 border-gray-700 hover:bg-gray-700"
            }`}
          >
            {t.imageLibrary.selectMode}
          </button>
        </div>

        {/* Select mode actions */}
        {selectMode && selectedIds.size > 0 && (
          <div className="flex items-center gap-2 mb-3">
            <span className="text-sm text-gray-400">
              {t.imageLibrary.selectedCount.replace(
                "{count}",
                String(selectedIds.size)
              )}
            </span>
            <div className="flex-1" />
            <button
              onClick={() => {
                setSlideshowNamePrompt(true);
              }}
              className="px-3 py-1.5 rounded-lg text-sm bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 border border-blue-600/40 transition-colors"
            >
              {t.imageLibrary.createSlideshow}
            </button>
            {confirmBulkDelete ? (
              <div className="flex items-center bg-gray-800 border border-gray-700/50 rounded-lg overflow-hidden">
                <button
                  onClick={handleDeleteSelected}
                  className="px-3 py-1.5 text-sm font-medium text-red-400 hover:bg-red-600/20 transition-colors"
                >
                  {t.imageLibrary.confirmBulkDelete}
                </button>
                <button
                  onClick={() => setConfirmBulkDelete(false)}
                  className="px-3 py-1.5 text-sm text-gray-400 hover:bg-gray-700 transition-colors"
                >
                  {t.imageLibrary.cancel}
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmBulkDelete(true)}
                className="px-3 py-1.5 rounded-lg text-sm bg-red-600/20 text-red-400 hover:bg-red-600/30 border border-red-600/40 transition-colors"
              >
                {t.imageLibrary.delete}
              </button>
            )}
          </div>
        )}

        {/* Grid */}
        {filteredSlideshows.length === 0 &&
        filteredUngrouped.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500">{t.imageLibrary.noImages}</p>
            <p className="text-gray-600 text-sm mt-1">
              {t.imageLibrary.noImagesHint}
            </p>
          </div>
        ) : (
          <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))" }}>
            {/* Slideshow cards */}
            {filteredSlideshows.map((slideshow) => {
              const info = slideshowInfo.get(slideshow.id);
              const firstImage = info?.first ?? null;
              const count = info?.count ?? 0;

              return (
                <button
                  key={`slideshow-${slideshow.id}`}
                  onClick={() =>
                    setView({ type: "slideshow", slideshowId: slideshow.id })
                  }
                  className="group bg-gray-900/50 border border-gray-700/30 rounded-lg overflow-hidden hover:border-blue-500/50 transition-colors relative"
                >
                  {/* Stacked effect */}
                  <div className="absolute -top-1 left-1 right-1 h-2 bg-gray-800/80 border border-gray-700/30 rounded-t-lg" />
                  <div className="relative">
                    <div className="aspect-video bg-gray-800">
                      {count > 0 && firstImage && getImageThumbnailUrl(firstImage) ? (
                        <img
                          src={getImageThumbnailUrl(firstImage)!}
                          alt={slideshow.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <span className="text-xs text-gray-600">{t.imageLibrary.emptySlideshowLabel}</span>
                        </div>
                      )}
                    </div>
                    {/* Count badge */}
                    {count > 0 && (
                      <div className="absolute top-2 right-2 bg-black/70 px-2 py-0.5 rounded-full">
                        <span className="text-xs text-white font-medium">
                          {count}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="p-2">
                    <p className="text-xs text-gray-300 truncate font-medium group-hover:text-blue-400">
                      {slideshow.name}
                    </p>
                    <p className="text-xs text-gray-500">
                      {t.imageLibrary.slideshow}
                    </p>
                  </div>
                </button>
              );
            })}

            {/* Ungrouped images */}
            {filteredUngrouped.map((image) => (
              <div
                key={image.id}
                className={`group bg-gray-900/50 border rounded-lg overflow-hidden transition-colors relative ${
                  selectedIds.has(image.id)
                    ? "border-blue-500/50 bg-blue-950/20"
                    : "border-gray-700/30 hover:border-gray-600"
                }`}
              >
                <button
                  onClick={() => {
                    if (selectMode) {
                      toggleSelect(image.id);
                    } else {
                      library.presentImage(image);
                    }
                  }}
                  className="w-full text-left"
                >
                  <div className="aspect-video bg-gray-800 relative">
                    {getImageThumbnailUrl(image) && (
                      <img
                        src={getImageThumbnailUrl(image)!}
                        alt={image.name}
                        className="w-full h-full object-cover"
                      />
                    )}
                    {selectMode && (
                      <div className="absolute top-2 left-2">
                        <div
                          className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                            selectedIds.has(image.id)
                              ? "bg-blue-500 border-blue-500"
                              : "border-gray-400 bg-black/30"
                          }`}
                        >
                          {selectedIds.has(image.id) && (
                            <svg
                              className="w-3 h-3 text-white"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={3}
                                d="M5 13l4 4L19 7"
                              />
                            </svg>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </button>
                <div className="p-2 flex items-center gap-1">
                  {renamingId === image.id ? (
                    <input
                      autoFocus
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onBlur={commitRename}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") commitRename();
                        if (e.key === "Escape") setRenamingId(null);
                      }}
                      className="flex-1 bg-gray-800 border border-gray-700 rounded px-2 py-0.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  ) : (
                    <p
                      className="text-xs text-gray-400 truncate flex-1 cursor-pointer"
                      onDoubleClick={() => startRename(image)}
                    >
                      {image.name}
                    </p>
                  )}
                  {!selectMode && confirmDeleteId === image.id ? (
                    <div className="flex items-center bg-gray-800 border border-gray-700/50 rounded-md overflow-hidden">
                      <button
                        onClick={() => { handleDelete(image.id); setConfirmDeleteId(null); }}
                        className="px-2 py-1 text-xs font-medium text-red-400 hover:bg-red-600/20 transition-colors"
                      >
                        {t.imageLibrary.confirmDelete}
                      </button>
                      <button
                        onClick={() => setConfirmDeleteId(null)}
                        className="px-2 py-1 text-xs text-gray-400 hover:bg-gray-700 transition-colors"
                      >
                        {t.imageLibrary.cancel}
                      </button>
                    </div>
                  ) : !selectMode ? (
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-all">
                      {window.electronAPI && (
                        <button
                          onClick={() => window.electronAPI?.showItemInFolder(image.path)}
                          className="p-1 rounded hover:bg-gray-700 text-gray-500 hover:text-gray-300 transition-colors"
                          title={t.imageLibrary.openFileLocation}
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                          </svg>
                        </button>
                      )}
                      <button
                        onClick={() => setConfirmDeleteId(image.id)}
                        className="p-1 rounded hover:bg-red-600/20 text-gray-500 hover:text-red-400 transition-colors"
                      >
                        <CloseIcon className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
        </Card>
      </div>
    </div>
  );
}
