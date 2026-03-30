import type { ImageState } from "../../shared/types";
import { getFileUrl } from "../../shared/utils";

interface Props {
  config: ImageState;
}

export default function ImageMode({ config }: Props) {
  if (!config.src) {
    return <div className="w-full h-full bg-black" />;
  }

  const isSlideshow = config.slideshowImages.length > 1;

  return (
    <div className="w-full h-full bg-black relative">
      <img
        key={config.src}
        src={getFileUrl(config.src)}
        alt=""
        className="w-full h-full"
        style={{
          objectFit: config.fit === "fill" ? "cover" : "contain",
        }}
      />
      {isSlideshow && (
        <div className="absolute bottom-4 right-6 bg-black/60 px-3 py-1.5 rounded-lg">
          <span className="text-white/80 text-sm tabular-nums">
            {config.currentIndex + 1} / {config.slideshowImages.length}
          </span>
        </div>
      )}
    </div>
  );
}
