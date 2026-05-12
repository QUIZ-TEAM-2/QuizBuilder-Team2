import { INPUT_COMPONENT_SLUG } from "./types";

export function InputAsset() {
  return (
    <div className="flex flex-col items-center justify-center gap-2 p-3">
      <div className="w-12 h-8 bg-gray-200 rounded border border-gray-400 flex items-center px-2">
        <span className="text-xs text-gray-500">Input</span>
      </div>
      <span className="text-xs text-gray-600">Input Box</span>
    </div>
  );
}

InputAsset.displayName = "InputAsset";

export { INPUT_COMPONENT_SLUG };
