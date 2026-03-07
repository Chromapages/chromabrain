import type { Metadata } from "next";
import SearchUI from "./SearchUI";

export const metadata: Metadata = {
  title: "Search — ChromaBrain",
  description: "Search across your entire knowledge base instantly.",
};

export default function SearchPage() {
  return <SearchUI />;
}
