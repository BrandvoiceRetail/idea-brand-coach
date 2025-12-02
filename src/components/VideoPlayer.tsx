interface VideoPlayerProps {
  videoId: string;
  platform?: "youtube" | "vimeo";
  title?: string;
  className?: string;
}

/**
 * VideoPlayer component for embedding YouTube or Vimeo videos
 *
 * @param videoId - The video ID from YouTube or Vimeo
 * @param platform - The video platform (defaults to "youtube")
 * @param title - Accessible title for the iframe
 * @param className - Additional CSS classes for the container
 */
export function VideoPlayer({
  videoId,
  platform = "youtube",
  title = "Training Video",
  className = ""
}: VideoPlayerProps): JSX.Element {
  const src = platform === "youtube"
    ? `https://www.youtube.com/embed/${videoId}`
    : `https://player.vimeo.com/video/${videoId}`;

  return (
    <div className={`aspect-video w-full ${className}`}>
      <iframe
        src={src}
        title={title}
        className="w-full h-full rounded-lg border-0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      />
    </div>
  );
}
