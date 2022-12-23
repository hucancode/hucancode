<script>
  export let posts = [];
</script>

<ul>
  {#each posts as post}
    <li class="mb-2 p-2">
      <article>
        <a href="/blog/post/{post.slug}">
          <h2 class="text-xl hover:text-blue-400">
            {post.title}
          </h2>
        </a>
      </article>
      <p class="text-sm text-gray-400">{post.excerpt}</p>
    </li>
  {/each}
</ul>
