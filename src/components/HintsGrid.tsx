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
  const lengthColumns = Array.from(
    new Set(
      Object.values(hintsData).flatMap((letterData) =>
        Object.keys(letterData).map(Number)
      )
    )
  ).sort((a, b) => a - b);

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

  

  return (
    <Card className="p-6 bg-slate-900 border-slate-700">
      <div className="mb-4">
        <h2 className="text-2xl font-bold text-slate-100 mb-2">Hints Grid</h2>
        <p className="text-slate-300">Word counts by starting letter and length</p>
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-slate-600">
              <th className="p-2 text-left font-semibold text-slate-100">Letter</th>
              {lengthColumns.map(length => (
                <th key={length} className="p-2 text-center font-semibold text-slate-100 min-w-[60px]">
                  {length}
                </th>
              ))}
              <th className="p-2 text-center font-semibold text-yellow-400">Total</th>
            </tr>
          </thead>
          <tbody>
            {letters.map(letter => (
              <tr key={letter} className="border-t border-slate-700/50 hover:bg-slate-800/50 transition-colors">
                <td className="p-2 font-mono font-semibold text-lg text-slate-100 uppercase">
                  {letter}
                </td>
                {lengthColumns.map(length => {
                  const count = getCountForCell(letter, length);
                  return (
                    <td key={length} className="p-2 text-center">
                      {count > 0 && (
                        <Badge 
                          variant="secondary" 
                          className="bg-slate-700 text-slate-100 hover:bg-slate-600 transition-colors duration-200"
                        >
                          {count}
                        </Badge>
                      )}
                    </td>
                  );
                })}
                <td className="p-2 text-center">
                  <Badge 
                    variant="default" 
                    className="bg-yellow-600 text-slate-100 hover:bg-yellow-500 transition-colors duration-200"
                  >
                    {getTotalForLetter(letter)}
                  </Badge>
                </td>
              </tr>
            ))}
            <tr className="border-t-2 border-yellow-600/30 bg-slate-800/30">
              <td className="p-2 font-semibold text-slate-100">Total</td>
              {lengthColumns.map(length => (
                <td key={length} className="p-2 text-center">
                  <Badge 
                    variant="outline" 
                    className="border-yellow-500/50 text-yellow-400 hover:bg-yellow-600/10 transition-colors duration-200"
                  >
                    {getTotalForLength(length)}
                  </Badge>
                </td>
              ))}
              <td className="p-2 text-center">
                <Badge 
                  variant="default" 
                  className="bg-yellow-600 text-slate-100 font-bold shadow-md"
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