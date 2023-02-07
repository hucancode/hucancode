import { randomThumbnail } from "$lib/server/thumbnail";
const POST_PER_PAGE = 5;

export default async function fetchPosts({ page = 1, category = "" } = {}) {
  const offset = (page - 1) * POST_PER_PAGE;
  const take = POST_PER_PAGE;
  let posts = await Promise.all(
    Object.entries(import.meta.glob("/src/posts/*.md")).map(
      async ([path, resolver]) => {
        const { metadata } = await resolver();
        const slug = path.split("/").pop().slice(0, -3);
        return { ...metadata, slug };
      }
    )
  );
  if (category) {
    posts = posts.filter((post) => post.categories.includes(category));
  }
  posts = posts
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(offset, offset + take);
  posts = await Promise.all(
    posts.map(async function (post) {
      if (!post.cover) {
        post.cover = await randomThumbnail(post.slug);
      }
      return {
        title: post.title,
        slug: post.slug,
        excerpt: post.excerpt,
        cover: post.cover,
        date: post.date,
        categories: post.categories,
      };
    })
  );
  return { posts: posts };
}

export async function fetchPostCount({ category = "" } = {}) {
  let posts = import.meta.glob("/src/posts/*.md");
  if (category) {
    posts = await Promise.all(
      Object.entries(posts).map(async ([path, resolver]) => {
        const { metadata } = await resolver();
        return { ...metadata };
      })
    );
    posts = posts.filter((post) => post.categories.includes(category));
  }
  return Object.keys(posts).length;
}

export async function fetchPageCount(props) {
  const count = await fetchPostCount(props);
  return Math.ceil(count / POST_PER_PAGE);
}
