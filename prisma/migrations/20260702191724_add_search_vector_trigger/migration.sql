-- Create function to update search vector
CREATE OR REPLACE FUNCTION article_search_vector_update() RETURNS trigger AS $$
BEGIN
  NEW."searchVector" :=
    setweight(to_tsvector('english', COALESCE(NEW.title, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(NEW.description, '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(NEW."sourceDomain", '')), 'C') ||
    setweight(to_tsvector('english', COALESCE(NEW.url, '')), 'C');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
CREATE TRIGGER article_search_vector_trigger
  BEFORE INSERT OR UPDATE OF title, description, "sourceDomain", url
  ON "Article"
  FOR EACH ROW
  EXECUTE FUNCTION article_search_vector_update();

-- Backfill existing rows
UPDATE "Article" SET title = title WHERE TRUE;