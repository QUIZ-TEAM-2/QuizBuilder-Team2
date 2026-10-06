/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";
import type * as aiQuiz from "../aiQuiz.js";
import type * as aiQuizDraft from "../aiQuizDraft.js";
import type * as analytics from "../analytics.js";
import type * as audios from "../audios.js";
import type * as auth from "../auth.js";
import type * as bootstrap from "../bootstrap.js";
import type * as http from "../http.js";
import type * as images from "../images.js";
import type * as knowledgeScoring from "../knowledgeScoring.js";
import type * as quiz from "../quiz.js";
import type * as quizAccessRules from "../quizAccessRules.js";
import type * as quizPlay from "../quizPlay.js";
import type * as schemas from "../schemas.js";
import type * as sendgridOtp from "../sendgridOtp.js";
import type * as templates from "../templates.js";

/**
 * A utility for referencing Convex functions in your app's API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
declare const fullApi: ApiFromModules<{
  aiQuiz: typeof aiQuiz;
  aiQuizDraft: typeof aiQuizDraft;
  analytics: typeof analytics;
  audios: typeof audios;
  auth: typeof auth;
  bootstrap: typeof bootstrap;
  http: typeof http;
  images: typeof images;
  knowledgeScoring: typeof knowledgeScoring;
  quiz: typeof quiz;
  quizAccessRules: typeof quizAccessRules;
  quizPlay: typeof quizPlay;
  schemas: typeof schemas;
  sendgridOtp: typeof sendgridOtp;
  templates: typeof templates;
}>;
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;
