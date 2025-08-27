import { useState, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Upload, X, Image as ImageIcon } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ImageUploadProps {
  onWordsExtracted: (words: string[]) => void;
}

const ImageUpload = ({ onWordsExtracted }: ImageUploadProps) => {
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();

  const handleFileUpload = useCallback((files: FileList | null) => {
    if (!files) return;
    
    const newFiles = Array.from(files).filter(file => 
      file.type.startsWith('image/')
    );
    
    if (newFiles.length === 0) {
      toast({
        title: "Invalid file type",
        description: "Please upload image files only.",
        variant: "destructive"
      });
      return;
    }

    setUploadedFiles(prev => [...prev, ...newFiles]);
    
    // Simulate OCR processing for demo
    setIsProcessing(true);
    setTimeout(() => {
      const mockWords = [
        'QUEEN', 'BUZZ', 'HIVE', 'HONEY', 'POLLEN', 'SWARM', 'NECTAR',
        'FLOWER', 'GARDEN', 'SWEET', 'GOLDEN', 'FLYING'
      ].slice(0, Math.floor(Math.random() * 8) + 3);
      
      onWordsExtracted(mockWords);
      setIsProcessing(false);
      
      toast({
        title: "Words extracted!",
        description: `Found ${mockWords.length} words from your images.`,
      });
    }, 2000);
  }, [onWordsExtracted, toast]);

  const removeFile = (index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    handleFileUpload(e.dataTransfer.files);
  }, [handleFileUpload]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  return (
    <Card className="p-6 bg-gradient-to-br from-honeycomb/5 to-wax/30 border-honeycomb/20">
      <div className="mb-4">
        <h2 className="text-2xl font-bold text-foreground mb-2">Upload Word Images</h2>
        <p className="text-muted-foreground">Upload photos of the words you've found</p>
      </div>

      <div
        className="border-2 border-dashed border-honeycomb/40 rounded-lg p-8 text-center hover:border-honeycomb/60 transition-colors duration-300 bg-background/50"
        onDrop={handleDrop}
        onDragOver={handleDragOver}
      >
        <div className="flex flex-col items-center gap-4">
          <div className="p-4 rounded-full bg-honeycomb/10">
            <Upload className="h-8 w-8 text-honeycomb" />
          </div>
          <div>
            <p className="text-lg font-medium text-foreground">Drop images here</p>
            <p className="text-muted-foreground">or click to browse</p>
          </div>
          <input
            type="file"
            multiple
            accept="image/*"
            onChange={(e) => handleFileUpload(e.target.files)}
            className="hidden"
            id="file-upload"
          />
          <Button 
            variant="outline" 
            onClick={() => document.getElementById('file-upload')?.click()}
            className="border-honeycomb/50 hover:bg-honeycomb/10 hover:border-honeycomb"
          >
            Choose Files
          </Button>
        </div>
      </div>

      {uploadedFiles.length > 0 && (
        <div className="mt-6">
          <h3 className="font-semibold text-foreground mb-3">Uploaded Images ({uploadedFiles.length})</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {uploadedFiles.map((file, index) => (
              <div key={index} className="relative group">
                <div className="aspect-square bg-muted rounded-lg flex items-center justify-center border border-border/50 group-hover:border-honeycomb/50 transition-colors duration-200">
                  <ImageIcon className="h-8 w-8 text-muted-foreground" />
                </div>
                <button
                  onClick={() => removeFile(index)}
                  className="absolute -top-2 -right-2 p-1 bg-destructive text-destructive-foreground rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-200 hover:bg-destructive/90"
                >
                  <X className="h-4 w-4" />
                </button>
                <p className="text-xs text-muted-foreground mt-1 truncate">{file.name}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {isProcessing && (
        <div className="mt-6 p-4 bg-honeycomb/10 rounded-lg border border-honeycomb/20">
          <div className="flex items-center gap-3">
            <div className="animate-spin rounded-full h-5 w-5 border-2 border-honeycomb border-t-transparent"></div>
            <span className="text-foreground font-medium">Processing images...</span>
          </div>
          <p className="text-muted-foreground text-sm mt-1">Extracting words from your images</p>
        </div>
      )}
    </Card>
  );
};

export default ImageUpload;