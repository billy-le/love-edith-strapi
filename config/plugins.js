module.exports = ({ env }) => ({
  upload: {
    provider: "imagekit",
    providerOptions: {
      publicKey: env("IMAGEKIT_PUBLIC"),
      privateKey: env("IMAGEKIT_PRIVATE"),
      urlEndpoint: env("IMAGEKIT_URL"),
      params: {
        folder: env("IMAGEKIT_FOLDER"),
      },
    },
  },
});
