import { SITE_URL } from "../lib/site.js";

export default function sitemap() {
  return [
    {
      url: SITE_URL,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${SITE_URL}/create`,
      changeFrequency: "monthly",
      priority: 0.9,
    },
  ];
}
