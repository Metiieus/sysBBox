import { useEffect, useState } from "react";
import { Order, OrderProduct } from "@/hooks/useFirebase"; // Importar tipos
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"; // Importar Select
import { toast } from "@/components/ui/use-toast"; // Importar toast
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import {
  Calendar as CalendarIcon,
  Package,
  DollarSign,
  Plus,
  Minus,
  Save,
  X,
} from "lucide-react";
import { OrderFragment as OrderFragmentType } from "@/types/order";
import { format, addDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface OrderFragmentFormProps {
  order: Order; // Passar o pedido completo
  products: OrderProduct[]; // Passar a lista de produtos
  onSave: (fragments: OrderFragmentType[]) => void;
  onCancel: () => void;
  initialFragments?: OrderFragmentType[];
}

export default function OrderFragmentForm({
  order,
  products,
  onSave,
  onCancel,
  initialFragments = [],
}: OrderFragmentFormProps) {
  const [selectedProductId, setSelectedProductId] = useState<string>(
    products[0]?.id || ""
  );

  const selectedProduct = products.find((p) => p.id === selectedProductId);
  
  const productTotalQuantity = selectedProduct?.quantity || 0;
  const productTotalValue = selectedProduct?.total_price || 0;
  
  const productFragments = initialFragments.filter(
    (f) => f.productId === selectedProductId
  );
  const [fragments, setFragments] = useState<Partial<OrderFragmentType>[]>(
    () =>
      productFragments.length > 0
        ? productFragments.map((fragment) => ({
            ...fragment,
            scheduledDate: fragment.scheduledDate
              ? new Date(fragment.scheduledDate)
              : new Date(),
          }))
        : [
            {
              fragmentNumber: 1,
              quantity: Math.max(1, Math.ceil(productTotalQuantity / 4)),
              scheduledDate: new Date(),
              status: "pending",
              progress: 0,
              productId: selectedProductId,
            },
          ],
  );
  const [showCalendar, setShowCalendar] = useState<number | null>(null);

  useEffect(() => {
    // Recalcular fragments quando o produto selecionado muda
    const newProductFragments = initialFragments.filter(
      (f) => f.productId === selectedProductId
    );
    
    setFragments(
      newProductFragments.length > 0
        ? newProductFragments.map((fragment) => ({
            ...fragment,
            scheduledDate: fragment.scheduledDate
              ? new Date(fragment.scheduledDate)
              : new Date(),
          }))
        : [
            {
              fragmentNumber: 1,
              quantity: Math.max(1, Math.ceil(productTotalQuantity / 4)),
              scheduledDate: new Date(),
              status: "pending",
              progress: 0,
              productId: selectedProductId,
            },
          ],
    );
  }, [selectedProductId, initialFragments, productTotalQuantity]);

  const addFragment = () => {
    const lastFragment = fragments[fragments.length - 1];
    const nextDate = lastFragment?.scheduledDate
      ? addDays(lastFragment.scheduledDate, 1)
      : new Date();

    setFragments((prev) => [
      ...prev,
      {
        fragmentNumber: prev.length + 1,
        quantity: 1,
        scheduledDate: nextDate,
        status: "pending",
        progress: 0,
      },
    ]);
  };

  const removeFragment = (index: number) => {
    if (fragments.length > 1) {
      setFragments((prev) => prev.filter((_, i) => i !== index));
    }
  };

  const updateFragment = (index: number, field: string, value: any) => {
    setFragments((prev) =>
      prev.map((fragment, i) =>
        i === index ? { ...fragment, [field]: value } : fragment,
      ),
    );
  };

  const updateFragmentDate = (index: number, date: Date) => {
    updateFragment(index, "scheduledDate", date);
    setShowCalendar(null);
  };

  const calculateFragmentValue = (quantity: number) => {
    if (productTotalQuantity === 0) return 0;
    return (quantity / productTotalQuantity) * productTotalValue;
  };

  const getTotalFragmentQuantity = () => {
    return fragments.reduce(
      (sum, fragment) => sum + (fragment.quantity || 0),
      0,
    );
  };

  const getTotalFragmentValue = () => {
    return fragments.reduce(
      (sum, fragment) => sum + calculateFragmentValue(fragment.quantity || 0),
      0,
    );
  };

  const isValid = () => {
    return (
      getTotalFragmentQuantity() === productTotalQuantity &&
      fragments.every((f) => f.quantity && f.quantity > 0 && f.scheduledDate)
    );
  };

  const handleSave = () => {
    if (!isValid()) {
      toast({
        title: "Erro de Validação",
        description:
          `A quantidade total fragmentada (${getTotalFragmentQuantity()}) deve ser igual à quantidade total do produto selecionado (${productTotalQuantity}) e todos os campos devem ser preenchidos.`,
        variant: "destructive",
      });
      return;
    }

    // Filtrar fragmentos dos outros produtos
    const otherFragments = initialFragments.filter(
      (f) => f.productId !== selectedProductId
    );
    
    const baseOrderId = order.id;

    const currentProductFragments: OrderFragmentType[] = fragments.map(
      (fragment, index) => ({
        id:
          fragment.id ||
          `${baseOrderId}-frag-${fragment.fragmentNumber || index + 1}-${Date.now()}`,
        orderId: baseOrderId,
        productId: selectedProductId, // Adicionar productId
        fragmentNumber: fragment.fragmentNumber || index + 1,
        quantity: fragment.quantity || 0,
        scheduledDate: fragment.scheduledDate || new Date(),
        status: fragment.status || "pending",
        progress: fragment.progress || 0,
        value: calculateFragmentValue(fragment.quantity || 0),
      }),
    );

    const finalFragments = [...otherFragments, ...currentProductFragments];

    onSave(finalFragments);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const quantityDifference = getTotalFragmentQuantity() - productTotalQuantity;

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-3xl max-h-[90vh] overflow-y-auto bg-card border-border">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center space-x-2">
              <Package className="h-5 w-5" />
              <span>Fragmentar Produção</span>
            </CardTitle>
            <Button variant="ghost" size="icon" onClick={onCancel}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="text-sm text-muted-foreground">
            Divida a produção de unidades em lotes menores
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {products.length > 1 && (
            <div className="space-y-2">
              <Label htmlFor="product-select">
                Selecione o Produto para Fragmentar
              </Label>
              <Select
                value={selectedProductId}
                onValueChange={(value) => {
                  setSelectedProductId(value);
                }}
              >
                <SelectTrigger id="product-select">
                  <SelectValue placeholder="Selecione um produto" />
                </SelectTrigger>
                <SelectContent>
                  {products.map((product) => (
                    <SelectItem key={product.id} value={product.id}>
                      {product.product_name} ({product.quantity} unidades)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Summary */}
          <div className="grid grid-cols-3 gap-4 p-4 bg-muted/5 rounded-lg">
            <div className="text-center">
              <p className="text-sm text-muted-foreground">Quantidade Total</p>
              <p className="text-lg font-bold">
                {productTotalQuantity} unidades
              </p>
            </div>
            <div className="text-center">
              <p className="text-sm text-muted-foreground">Valor Total</p>
              <p className="text-lg font-bold">
                {formatCurrency(productTotalValue)}
              </p>
            </div>
            <div className="text-center">
              <p className="text-sm text-muted-foreground">Fragmentos</p>
              <p className="text-lg font-bold">{fragments.length}</p>
            </div>
          </div>

          {/* Fragments */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium">Fragmentos de Produção</h3>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addFragment}
              >
                <Plus className="h-4 w-4 mr-2" />
                Adicionar Fragmento
              </Button>
            </div>

            {fragments.map((fragment, index) => (
              <Card key={index} className="bg-muted/5 border-dashed">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-medium">
                      Fragmento {fragment.fragmentNumber}
                    </h4>
                    {fragments.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeFragment(index)}
                      >
                        <Minus className="h-4 w-4" />
                      </Button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <Label>Quantidade</Label>
                      <Input
                        type="number"
                        min="1"
                        max={productTotalQuantity}
                        value={fragment.quantity || ""}
                        onChange={(e) =>
                          updateFragment(
                            index,
                            "quantity",
                            parseInt(e.target.value) || 0,
                          )
                        }
                        placeholder="Qtd"
                      />
                    </div>
                    <div>
                      <Label>Data de Produção</Label>
                      <Popover
                        open={showCalendar === index}
                        onOpenChange={(open) =>
                          setShowCalendar(open ? index : null)
                        }
                      >
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className="w-full justify-start text-left font-normal"
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {fragment.scheduledDate
                              ? format(fragment.scheduledDate, "dd/MM/yyyy", {
                                  locale: ptBR,
                                })
                              : "Selecionar data"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={fragment.scheduledDate}
                            onSelect={(date) =>
                              date && updateFragmentDate(index, date)
                            }
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                    <div>
                      <Label>Valor do Fragmento</Label>
                      <div className="flex items-center h-10 px-3 py-2 border border-input rounded-md bg-muted/5">
                        <DollarSign className="h-4 w-4 mr-2 text-muted-foreground" />
                        <span className="text-sm font-medium">
                          {formatCurrency(
                            calculateFragmentValue(fragment.quantity || 0),
                          )}
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Validation */}
          <div className="p-4 border border-border rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Validação</span>
              <Badge
                variant="outline"
                className={cn(
                  isValid()
                    ? "bg-biobox-green/10 text-biobox-green border-biobox-green/20"
                    : "bg-red-500/10 text-red-500 border-red-500/20",
                )}
              >
                {isValid() ? "Válido" : "Inválido"}
              </Badge>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="flex justify-between">
                <span>Quantidade Total:</span>
                <span
                  className={cn(
                    "font-medium",
                    quantityDifference === 0
                      ? "text-biobox-green"
                      : "text-red-500",
                  )}
                >
                  {getTotalFragmentQuantity()} / {productTotalQuantity}
                  {quantityDifference !== 0 && (
                    <span className="ml-1">
                      ({quantityDifference > 0 ? "+" : ""}
                      {quantityDifference})
                    </span>
                  )}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Valor Total:</span>
                <span className="font-medium">
                  {formatCurrency(getTotalFragmentValue())}
                </span>
              </div>
            </div>
          </div>

          <div className="flex justify-end space-x-4 pt-4">
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancelar
            </Button>
            <Button
              onClick={handleSave}
              disabled={!isValid()}
              className="bg-biobox-green hover:bg-biobox-green-dark"
            >
              <Save className="h-4 w-4 mr-2" />
              Salvar Fragmentação
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
