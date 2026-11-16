-- File upload feature: an event can show a banner image uploaded through the API (multer).
ALTER TABLE events ADD COLUMN banner_url TEXT;
