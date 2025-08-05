import { ResearchModule } from "@/components/ResearchModule";

export default function ResearchLearning() {
  return (
    <div className="container mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground mb-4">
          Strategic Brand Research
        </h1>
        <p className="text-lg text-muted-foreground">
          Master the art of strategic brand research with our comprehensive interactive modules.
        </p>
      </div>
      
      <ResearchModule />
    </div>
  );
}