module.exports = {
	ci: {
		collect: {
			url: ["http://localhost:3000/"],
			startServerCommand: "cd frontend && npm run build && npm run start",
			numberOfRuns: 3,
		},
		upload: {
			target: "temporary-public-storage",
		},
		assert: {
			preset: "lighthouse:recommended",
			assertions: {
				"categories:performance": ["warn", { minScore: 0.9 }],
				"categories:accessibility": ["error", { minScore: 0.95 }],
				"categories:best-practices": ["error", { minScore: 0.95 }],
				"categories:seo": ["error", { minScore: 0.95 }],
				"unused-javascript": "off",
				"uses-rel-preconnect": "off",
			},
		},
	},
};
