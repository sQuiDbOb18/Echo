/** @type {import('next').NextConfig} */
const nextConfig = {
	webpack(config) {
		config.resolve.fallback = {
			...config.resolve.fallback,
			"@react-native-async-storage/async-storage": false,
			"pino-pretty": false,
		};
		return config;
	},
};

export default nextConfig;