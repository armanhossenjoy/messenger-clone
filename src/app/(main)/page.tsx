export default function ChatPlaceholder() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-neutral-400">
      <div className="w-16 h-16 rounded-full bg-neutral-100 flex items-center justify-center mb-4 border border-neutral-200 shadow-sm">
        <svg className="w-8 h-8 text-neutral-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
      </div>
      <p className="text-sm font-medium text-neutral-600">Your Messages</p>
      <p className="text-xs mt-1 text-center max-w-[250px] text-neutral-400">Select a chat from the sidebar or find new friends to start messaging.</p>
    </div>
  );
}
