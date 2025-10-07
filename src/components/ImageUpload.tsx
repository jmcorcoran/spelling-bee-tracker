import { useState, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Upload, X, Image as ImageIcon } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { createWorker } from 'tesseract.js';

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
    
    // Process images with OCR
    processImagesWithOCR(newFiles);
  }, [onWordsExtracted, toast]);

  const processImagesWithOCR = async (files: File[]) => {
    setIsProcessing(true);
    const allWords: string[] = [];

    try {
      const worker = await createWorker('eng');
      
      for (const file of files) {
        try {
          const { data: { text } } = await worker.recognize(file);
          
          // Extract words that are likely spelling bee words (4+ letters, all caps)
          const words = text
            .split(/\s+/)
            .map(word => word.replace(/[^A-Za-z]/g, '').toUpperCase())
            .filter(word => word.length >= 4 && /^[A-Z]+$/.test(word));
          
          allWords.push(...words);
        } catch (error) {
          console.error('Error processing image:', file.name, error);
        }
      }
      
      await worker.terminate();
      
      // Remove duplicates
      const uniqueWords = Array.from(new Set(allWords));
      
      if (uniqueWords.length > 0) {
        onWordsExtracted(uniqueWords);
        toast({
          title: "Words extracted!",
          description: `Found ${uniqueWords.length} words from your images.`,
        });
      } else {
        toast({
          title: "No words found",
          description: "Could not extract any valid words from the images.",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('OCR processing error:', error);
      toast({
        title: "Processing failed",
        description: "Error extracting text from images. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  };

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
    <Card className="p-4 bg-slate-900/90 border-slate-700/50 backdrop-blur-sm">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-lg font-semibold text-slate-100">Upload Images</h3>
          <p className="text-sm text-slate-400">Extract words from photos</p>
        </div>
        <Badge variant="secondary" className="bg-slate-800 text-slate-300">
          {uploadedFiles.length} files
        </Badge>
      </div>

      <div
        className="border-2 border-dashed border-slate-600/60 rounded-lg p-4 text-center hover:border-slate-500/80 transition-colors duration-300 bg-slate-800/50"
        onDrop={handleDrop}
        onDragOver={handleDragOver}
      >
        <div className="flex items-center justify-center gap-3">
          <div className="p-2 rounded-full bg-slate-700/50">
            <Upload className="h-5 w-5 text-slate-300" />
          </div>
          <div className="text-left">
            <p className="text-sm font-medium text-slate-200">Drop images or click to browse</p>
            <p className="text-xs text-slate-400">PNG, JPG, GIF up to 10MB</p>
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
            size="sm"
            onClick={() => document.getElementById('file-upload')?.click()}
            className="border-slate-600 bg-slate-800 text-slate-200 hover:bg-slate-700 hover:border-slate-500"
          >
            Browse
          </Button>
        </div>
      </div>

      {uploadedFiles.length > 0 && (
        <div className="mt-4">
          <div className="flex flex-wrap gap-2">
            {uploadedFiles.map((file, index) => (
              <div key={index} className="relative group flex items-center gap-2 bg-slate-800/60 rounded-lg p-2 border border-slate-700/50">
                <ImageIcon className="h-4 w-4 text-slate-400" />
                <span className="text-xs text-slate-300 max-w-24 truncate">{file.name}</span>
                <button
                  onClick={() => removeFile(index)}
                  className="p-1 bg-red-900/50 text-red-300 rounded-full hover:bg-red-800/60 transition-colors"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {isProcessing && (
        <div className="mt-4 p-3 bg-slate-800/60 rounded-lg border border-slate-700/50">
          <div className="flex items-center gap-3">
            <div className="animate-spin rounded-full h-4 w-4 border-2 border-slate-400 border-t-transparent"></div>
            <span className="text-slate-200 text-sm font-medium">Processing images...</span>
          </div>
        </div>
      )}
    </Card>
  );
};

export default ImageUpload;