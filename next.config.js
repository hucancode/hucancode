module.exports = {
    experimental: {
      appDir: true
    },
	async redirects() {
		return [
		  {
			source: '/',
			destination: '/en',
			permanent: true,
		  },
		]
	  },
    reactStrictMode: true,
}
