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
    if (maxLength > 7) {
      columns.push('8+');
    }
    return columns;
  };

  const getCountForCell = (letter: string, length: number | string) => {
    if (!hintsData[letter]) return 0;
    
    if (length === '8+') {
      return Object.entries(hintsData[letter])
        .filter(([len]) => Number(len) >= 8)
        .reduce((sum, [, count]) => sum + count, 0);
    }
    
    return hintsData[letter][length as number] || 0;
  };

  const getTotalForLetter = (letter: string) => {
    if (!hintsData[letter]) return 0;
    return Object.values(hintsData[letter]).reduce((sum, count) => sum + count, 0);
  };

  const getTotalForLength = (length: number | string) => {
    return letters.reduce((sum, letter) => sum + getCountForCell(letter, length), 0);
  };

  const lengthColumns = getLengthColumns();

  return (
    <Card className="p-6 bg-gradient-to-br from-wax to-background border-honeycomb/20">
      <div className="mb-4">
        <h2 className="text-2xl font-bold text-foreground mb-2">Hints Grid</h2>
        <p className="text-muted-foreground">Word counts by starting letter and length</p>
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className="p-2 text-left font-semibold text-foreground">Letter</th>
              {lengthColumns.map(length => (
                <th key={length} className="p-2 text-center font-semibold text-foreground min-w-[60px]">
                  {length}
                </th>
              ))}
              <th className="p-2 text-center font-semibold text-honeycomb-dark">Total</th>
            </tr>
          </thead>
          <tbody>
            {letters.map(letter => (
              <tr key={letter} className="border-t border-border/50">
                <td className="p-2 font-mono font-semibold text-lg text-foreground uppercase">
                  {letter}
                </td>
                {lengthColumns.map(length => {
                  const count = getCountForCell(letter, length);
                  return (
                    <td key={length} className="p-2 text-center">
                      {count > 0 && (
                        <Badge 
                          variant="secondary" 
                          className="bg-honeycomb/10 text-foreground hover:bg-honeycomb/20 transition-colors duration-200"
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
                    className="bg-honeycomb text-foreground hover:bg-honeycomb-dark transition-colors duration-200"
                  >
                    {getTotalForLetter(letter)}
                  </Badge>
                </td>
              </tr>
            ))}
            <tr className="border-t-2 border-honeycomb/30 bg-honeycomb/5">
              <td className="p-2 font-semibold text-foreground">Total</td>
              {lengthColumns.map(length => (
                <td key={length} className="p-2 text-center">
                  <Badge 
                    variant="outline" 
                    className="border-honeycomb text-honeycomb-dark hover:bg-honeycomb/10 transition-colors duration-200"
                  >
                    {getTotalForLength(length)}
                  </Badge>
                </td>
              ))}
              <td className="p-2 text-center">
                <Badge 
                  variant="default" 
                  className="bg-gradient-to-r from-honeycomb to-pollen text-foreground font-bold"
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