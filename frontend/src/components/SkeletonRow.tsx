
interface SkeletonRowProps {
  activeTab: 'rsi' | 'movers';
}

export function SkeletonRow({ activeTab }: SkeletonRowProps) {
  return (
    <tr className="border-b border-outline-variant/30 hover:bg-surface-container-highest/30 transition-colors">
      <td className="py-2 px-2 text-center">
        <div className="h-5 w-5 rounded skeleton-shimmer mx-auto"></div>
      </td>
      
      <td className="py-2 px-2">
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 rounded-full skeleton-shimmer shrink-0"></div>
          <div className="h-5 w-20 rounded skeleton-shimmer"></div>
        </div>
      </td>

      <td className="py-2 px-2 text-center">
        <div className="h-5 w-8 rounded skeleton-shimmer mx-auto"></div>
      </td>
      
      {activeTab === 'movers' && (
        <td className="py-2 px-2 text-right">
          <div className="h-5 w-20 ml-auto rounded skeleton-shimmer"></div>
        </td>
      )}
      
      <td className="py-2 px-2 text-right">
        <div className="h-5 w-16 ml-auto rounded skeleton-shimmer"></div>
      </td>
      
      {activeTab === 'rsi' ? (
        <>
          <td className="py-2 px-2 text-center"><div className="h-6 w-10 mx-auto rounded-full skeleton-shimmer"></div></td>
          <td className="py-2 px-2 text-center"><div className="h-6 w-10 mx-auto rounded-full skeleton-shimmer"></div></td>
          <td className="py-2 px-2 text-center"><div className="h-6 w-10 mx-auto rounded-full skeleton-shimmer"></div></td>
          <td className="py-2 px-2 text-right"><div className="h-5 w-20 ml-auto rounded skeleton-shimmer"></div></td>
          <td className="py-2 px-2 text-right"><div className="h-5 w-16 ml-auto rounded skeleton-shimmer"></div></td>
          <td className="py-2 px-2 text-right"><div className="h-5 w-24 ml-auto rounded skeleton-shimmer"></div></td>
        </>
      ) : (
        <>
          <td className="py-2 px-2 text-right"><div className="h-4 w-20 rounded skeleton-shimmer ml-auto"></div></td>
          <td className="py-2 px-2 text-center"><div className="h-6 w-16 mx-auto rounded skeleton-shimmer"></div></td>
        </>
      )}
    </tr>
  );
}
