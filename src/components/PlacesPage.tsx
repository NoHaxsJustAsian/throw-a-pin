import PlacesGrid from "./PlacesGrid"

export default function PlacesPage() {

  console.log("PlacesPage rendered");
  
  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold mb-6">Places</h1>
      <div className="flex flex-col lg:flex-row gap-6">
        <div className="flex-grow">
          <PlacesGrid />
        </div>
      </div>
    </div>
  )
}
