"use client";

export function ProgressBarAsset() {
  return (
    <div className="flex h-full w-full items-center justify-center rounded bg-gray-100">
      <div className="flex items-center gap-1.5">
        <div className="h-2 w-8 rounded-full bg-violet-200" />
        <div className="h-2 w-3 rounded-full bg-slate-300" />
        <div className="h-2 w-3 rounded-full bg-slate-300" />
      </div>
    </div>
  );
}

export default ProgressBarAsset;
