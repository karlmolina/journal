import React, { useState } from "react";

interface Entry {
  id: number;
  text: string;
  createdAt: Date;
}

export default function Journal() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [text, setText] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;

    const newEntry: Entry = {
      id: Date.now(),
      text: text.trim(),
      createdAt: new Date(),
    };

    setEntries([newEntry, ...entries]);
    setText("");
  };

  return (
    <div className="max-w-xl mx-auto p-6">
      <h1 className="text-4xl font-bold mb-8 text-center">My Journal</h1>
      <form onSubmit={handleSubmit} className="mb-8">
        <textarea
          className="textarea textarea-bordered w-full h-32 resize-none"
          placeholder="Write your journal entry here..."
          value={text}
          onChange={(e) => setText(e.target.value)}
        />

        <button type="submit" className="btn btn-primary mt-4 w-full">
          Add Entry
        </button>
      </form>

      {entries.length === 0 ? (
        <p className="text-center text-gray-500">
          No entries yet. Start journaling!
        </p>
      ) : (
        <div className="space-y-4">
          {entries.map(({ id, text, createdAt }) => (
            <div key={id} className="card bg-base-100 shadow-md">
              <div className="card-body">
                <div className="text-sm text-gray-400 mb-2">
                  {createdAt.toLocaleString()}
                </div>
                <p className="whitespace-pre-wrap">{text}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
