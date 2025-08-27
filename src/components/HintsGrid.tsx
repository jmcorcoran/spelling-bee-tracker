import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

interface HintsData {
  [letter: string]: {
    [length: number]: number;
  };
}

interface HintsGridProps {
  hintsData: HintsData;
  foundWords: Set<string>;
}

const HintsGrid = ({ hintsData, foundWords }: HintsGridProps) => {
  const letters = Object.keys(hintsData).sort();
  const maxLength = Math.max(...Object.values(hintsData).flatMap(letterData => 
    Object.keys(letterData).map(Number)
  ));
  const minLength = 4;

  const getLengthColumns = () => {
    const columns = [];
    for (let i = minLength; i <= maxLength; i++) {
      columns.push(i);
    }
    return columns; // Remove the hardcoded 8+ logic
  };

  const getCountForCell = (letter: string, length: number) => {
    if (!hintsData[letter]) return 0;
    return hintsData[letter][length] || 0;
  };

  const getTotalForLetter = (letter: string) => {
    if (!hintsData[letter]) return 0;
    return Object.values(hintsData[letter]).reduce((sum, count) => sum + count, 0);
  };

  const getTotalForLength = (length: number) => {
    return letters.reduce((sum, letter) => sum + getCountForCell(letter, length), 0);
  };

  const lengthColumns = getLengthColumns();

  return (
    <Card className="p-3 sm:p-6 bg-slate-800/60 border-slate-700/50">
      <div className="mb-4">
        <h2 className="text-xl sm:text-2xl font-bold text-white mb-2">Hints Grid</h2>
        <p className="text-slate-300 text-sm sm:text-base">Word counts by starting letter and length</p>
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-xs sm:text-sm">
          <thead>
            <tr>
              <th className="p-1 sm:p-2 text-left font-semibold text-slate-200 w-20 sm:w-auto">Letter</th>
              {lengthColumns.map(length => (
                <th key={length} className="p-1 sm:p-2 text-center font-semibold text-slate-200 min-w-[40px] sm:min-w-[60px]">
                  {length}
                </th>
              ))}
              <th className="p-1 sm:p-2 text-center font-semibold text-blue-400">Total</th>
            </tr>
          </thead>
          <tbody>
            {letters.map(letter => (
              <tr key={letter} className="border-t border-slate-600/50">
                <td className="p-1 sm:p-2 font-mono text-xs sm:text-sm font-semibold text-slate-200 uppercase">
                  {letter}
                </td>
                {lengthColumns.map(length => {
                  const count = getCountForCell(letter, length);
                  return (
                    <td key={length} className="p-1 sm:p-2 text-center">
                      {count > 0 && (
                        <Badge 
                          variant="secondary" 
                          className="bg-slate-700/60 text-slate-200 hover:bg-slate-600/60 transition-colors duration-200 text-xs px-1 py-0.5"
                        >
                          {count}
                        </Badge>
                      )}
                    </td>
                  );
                })}
                <td className="p-1 sm:p-2 text-center">
                  <Badge 
                    variant="default" 
                    className="bg-blue-600 text-white hover:bg-blue-700 transition-colors duration-200 text-xs px-1 py-0.5"
                  >
                    {getTotalForLetter(letter)}
                  </Badge>
                </td>
              </tr>
            ))}
            <tr className="border-t-2 border-slate-500/50 bg-slate-700/30">
              <td className="p-1 sm:p-2 font-semibold text-slate-200 text-xs sm:text-sm">Total</td>
              {lengthColumns.map(length => (
                <td key={length} className="p-1 sm:p-2 text-center">
                  <Badge 
                    variant="outline" 
                    className="border-blue-500 text-blue-400 hover:bg-blue-500/10 transition-colors duration-200 text-xs px-1 py-0.5"
                  >
                    {getTotalForLength(length)}
                  </Badge>
                </td>
              ))}
              <td className="p-1 sm:p-2 text-center">
                <Badge 
                  variant="default" 
                  className="bg-gradient-to-r from-blue-600 to-purple-600 text-white font-bold text-xs px-1 py-0.5"
                >
                  {letters.reduce((sum, letter) => sum + getTotalForLetter(letter), 0)}
                </Badge>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </Card>
  );
};

export default HintsGrid;