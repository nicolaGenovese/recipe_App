import { Archivo } from "next/font/google";

/**
 * The landing page's one typeface: narrow and heavy for headings, like the labels and tickets of a
 * kitchen, and at normal width for reading. Self-hosted by Next.js at build time.
 */
export const landingFont = Archivo({ subsets: ["latin"], axes: ["wdth"], display: "swap", variable: "--font-landing" });
