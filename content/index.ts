import m01 from "./modules/m01-rag-foundations";
import m02 from "./modules/m02-pre-retrieval";
import m03 from "./modules/m03-hybrid-retrieval";
import m04 from "./modules/m04-post-retrieval";
import m05 from "./modules/m05-rerank";
import m12 from "./modules/m12-capstone";
import type { ModuleContent } from "./types";

// Add new modules here in order.
export const modules: ModuleContent[] = [m01, m02, m03, m04, m05, m12];
