/** @type {import('next').NextConfig} */
const nextConfig = {
    webpack: (config) => {
        config.resolve.alias = {
            ...config.resolve.alias,
            "sharp$": false,
            "onnxruntime-node$": false,
        };
        return config;
    },
    turbopack: {
        root: __dirname,
    },
};

module.exports = nextConfig;
