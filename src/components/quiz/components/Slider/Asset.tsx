"use client";

export function SliderAsset() {
  return (
    <div className="flex h-full w-full items-center justify-center rounded bg-gray-100 px-3">
      <div className="relative h-8 w-16">
        <div className="absolute left-0 right-0 top-3 h-1.5 rounded-full bg-white shadow-sm" />
        {[0, 1, 2, 3, 4].map((index) => (
          <div
            key={index}
            className="absolute top-3 h-3 w-px -translate-x-1/2 bg-slate-700"
            style={{ left: `${index * 25}%` }}
          />
        ))}
        <div className="absolute left-1/2 top-0 h-7 w-1 -translate-x-1/2 rounded-full bg-black" />
      </div>
    </div>
  );
}

export default SliderAsset;
