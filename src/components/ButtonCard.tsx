import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

export default function ButtonCard() {
  return (
    <Card>
      <CardContent className="p-4">
        <Button className="w-full">Add New Place</Button>
      </CardContent>
    </Card>
  )
}