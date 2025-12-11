interface VideoPlayerProps {
  videoId: string;
  platform?: "youtube" | "vimeo";
  title?: string;
  className?: string;
  /** Privacy hash for unlisted Vimeo videos */
  hash?: string;
}

/**
 * VideoPlayer component for embedding YouTube or Vimeo videos
 *
 * @param videoId - The video ID from YouTube or Vimeo
 * @param platform - The video platform (defaults to "youtube")
 * @param title - Accessible title for the iframe
 * @param className - Additional CSS classes for the container
 * @param hash - Privacy hash for unlisted Vimeo videos
 */
export function VideoPlayer({
  videoId,
  platform = "youtube",
  title = "Training Video",
  className = "",
  hash
}: VideoPlayerProps): JSX.Element {
  const getVimeoUrl = (): string => {
    const baseUrl = `https://player.vimeo.com/video/${videoId}`;
    return hash ? `${baseUrl}?h=${hash}` : baseUrl;
  };

  const src = platform === "youtube"
    ? `https://www.youtube.com/embed/${videoId}`
    : getVimeoUrl();

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
