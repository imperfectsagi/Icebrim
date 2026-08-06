-- ---------------------------------------------------------------------------
-- Add video / GIF support to banner (site_content), blog posts, gallery
-- images, and reviews.
--
-- Design choice: rather than a separate "videos" table, every place that
-- already stores an image gets an optional sibling *_video_src column and
-- a media_type marker. This keeps the existing image-only rendering code
-- working untouched wherever a video hasn't been set, and keeps queries
-- simple (no joins needed to know whether a row has a video).
-- ---------------------------------------------------------------------------

-- Blog posts: featured media can now be an image OR a video/gif.
ALTER TABLE blog_posts ADD COLUMN featured_media_type TEXT NOT NULL DEFAULT 'image' CHECK (featured_media_type IN ('image', 'video', 'gif'));
ALTER TABLE blog_posts ADD COLUMN featured_video_src TEXT;

-- Gallery images: each entry can now be an image, an animated gif, or a video clip.
ALTER TABLE gallery_images ADD COLUMN media_type TEXT NOT NULL DEFAULT 'image' CHECK (media_type IN ('image', 'video', 'gif'));
ALTER TABLE gallery_images ADD COLUMN video_src TEXT;

-- Reviews: customers (or admins editing on their behalf) can attach a short video review.
ALTER TABLE reviews ADD COLUMN media_type TEXT NOT NULL DEFAULT 'none' CHECK (media_type IN ('none', 'image', 'video'));
ALTER TABLE reviews ADD COLUMN media_src TEXT;

-- Media library: track what kind of file each uploaded asset is, so the
-- library UI can show a play icon for videos instead of trying to render
-- them all as static thumbnails.
ALTER TABLE media ADD COLUMN media_type TEXT NOT NULL DEFAULT 'image' CHECK (media_type IN ('image', 'video', 'gif'));
ALTER TABLE media ADD COLUMN duration_seconds REAL;
