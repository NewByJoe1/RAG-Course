import m01 from "./modules/m01-rag-foundations";
import m02 from "./modules/m02-pre-retrieval";
import m03 from "./modules/m03-hybrid-retrieval";
import m04 from "./modules/m04-post-retrieval";
import m05 from "./modules/m05-rerank";
import m06 from "./modules/m06-fine-tuned";
import m07 from "./modules/m07-eval";
import m08 from "./modules/m08-automation";
import m09 from "./modules/m09-harness";
import m10 from "./modules/m10-legal-domain";
import m11 from "./modules/m11-legal-embeddings";
import m12 from "./modules/m12-capstone";
import type { ModuleContent } from "./types";

// Add new modules here in order.
export const modules: ModuleContent[] = [m01, m02, m03, m04, m05, m06, m07, m08, m09, m10, m11, m12];
