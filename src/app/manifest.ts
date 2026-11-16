import type { MetadataRoute } from "next";

/** Lets phones and tablets add the app to the home screen; a tablet stays in kitchen mode once opened there. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Recipe Studio",
    short_name: "Recipe Studio",
    description: "Ricette, prep list, sicurezza alimentare e magazzino della cucina.",
    start_url: "/",
    display: "standalone",
    background_color: "#f7f7f3",
    theme_color: "#354632"
  };
}
