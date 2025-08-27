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
    <Card className="p-6 bg-card border-border">
      <div className="mb-4">
        <h2 className="text-2xl font-bold text-foreground mb-2">Hints Grid</h2>
        <p className="text-muted-foreground">Word counts by starting letter and length</p>
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-border">
              <th className="p-2 text-left font-semibold text-foreground">Letter</th>
              {lengthColumns.map(length => (
                <th key={length} className="p-2 text-center font-semibold text-foreground min-w-[60px]">
                  {length}
                </th>
              ))}
              <th className="p-2 text-center font-semibold text-primary">Total</th>
            </tr>
          </thead>
          <tbody>
            {letters.map(letter => (
              <tr key={letter} className="border-t border-border/50 hover:bg-muted/50 transition-colors">
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
                          className="bg-secondary/80 text-secondary-foreground hover:bg-secondary transition-colors duration-200"
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
                    className="bg-primary text-primary-foreground hover:bg-primary/90 transition-colors duration-200"
                  >
                    {getTotalForLetter(letter)}
                  </Badge>
                </td>
              </tr>
            ))}
            <tr className="border-t-2 border-primary/30 bg-muted/30">
              <td className="p-2 font-semibold text-foreground">Total</td>
              {lengthColumns.map(length => (
                <td key={length} className="p-2 text-center">
                  <Badge 
                    variant="outline" 
                    className="border-primary/50 text-primary hover:bg-primary/10 transition-colors duration-200"
                  >
                    {getTotalForLength(length)}
                  </Badge>
                </td>
              ))}
              <td className="p-2 text-center">
                <Badge 
                  variant="default" 
                  className="bg-primary text-primary-foreground font-bold shadow-md"
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