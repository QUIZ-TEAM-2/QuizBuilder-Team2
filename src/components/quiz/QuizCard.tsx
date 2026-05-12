"use client";

import { useRouter } from "next/navigation";

type Props = {
  quiz: {
    _id: string;
    title: string;
    description?: string;
  };
};

export default function QuizCard({
  quiz,
}: Props) {
  const router = useRouter();

  const handlePlay = () => {
    router.push(`/play/${quiz._id}?source=dashboard`);
  };

  return (
    <div className="border rounded-xl p-4 shadow-sm hover:shadow-md transition">

      <h2 className="text-lg font-semibold">
        {quiz.title}
      </h2>

      <p className="text-gray-600 mt-2">
        {quiz.description ||
          "No description"}
      </p >

      <button
        onClick={handlePlay}
        className="mt-4 w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700"
      >
        Play Quiz
      </button>

    </div>
  );
}
