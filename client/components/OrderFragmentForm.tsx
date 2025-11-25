import { useEffect, useState } from "react";
import { Order, OrderProduct } from "@/hooks/useFirebase"; // Importar tipos
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"; // Importar Select
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
    products[0]?.id || "",
  );

  const selectedProduct = products.find((p) => p.id === selectedProductId);

  const productTotalQuantity = selectedProduct?.quantity || 0;
  const productTotalValue = selectedProduct?.total_price || 0;

  const productFragments = initialFragments.filter(
    (f) => f.productId === selectedProductId,
  );
  const [fragments, setFragments] = useState<
    (Partial<OrderFragmentType> & { _tempId: string })[]
  >(() =>
    productFragments.length > 0
      ? productFragments.map((fragment) => ({
          ...fragment,
          _tempId:
            fragment.id || `temp-${Math.random().toString(36).substr(2, 9)}`,
          scheduledDate: fragment.scheduledDate
            ? new Date(fragment.scheduledDate)
            : new Date(),
        }))
      : [
          {
            _tempId: `temp-${Math.random().toString(36).substr(2, 9)}`,
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

  // Gerar sugestões de datas distribuídas para os fragmentos
  const generateDefaultFragmentDates = (count: number): Date[] => {
    const dates: Date[] = [];
    const startDate = new Date();
    startDate.setHours(0, 0, 0, 0);

    for (let i = 0; i < count; i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i); // Distribuir em dias diferentes
      dates.push(date);
    }
    return dates;
  };

  useEffect(() => {
    // Recalcular fragments quando o produto selecionado muda
    const newProductFragments = initialFragments.filter(
      (f) => f.productId === selectedProductId,
    );

    setFragments(
      newProductFragments.length > 0
        ? newProductFragments.map((fragment) => ({
            ...fragment,
            _tempId:
              fragment.id || `temp-${Math.random().toString(36).substr(2, 9)}`,
            scheduledDate: fragment.scheduledDate
              ? new Date(fragment.scheduledDate)
              : new Date(),
          }))
        : [
            {
              _tempId: `temp-${Math.random().toString(36).substr(2, 9)}`,
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
    // Se não tiver fragmentos anteriores ou a data está vazia, usar hoje
    // Caso contrário, adicionar 1 dia da última data
    const nextDate = lastFragment?.scheduledDate
      ? addDays(new Date(lastFragment.scheduledDate), 1)
      : new Date();

    // Garantir que a próxima data não seja no passado
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    if (nextDate < now) {
      nextDate.setTime(now.getTime());
    }

    setFragments((prev) => [
      ...prev,
      {
        _tempId: `temp-${Math.random().toString(36).substr(2, 9)}`,
        fragmentNumber: prev.length + 1,
        quantity: 1,
        scheduledDate: nextDate,
        status: "pending",
        progress: 0,
        productId: selectedProductId,
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
      getTotalFragmentQuantity() > 0 &&
      getTotalFragmentQuantity() <= productTotalQuantity &&
      fragments.every((f) => f.quantity && f.quantity > 0 && f.scheduledDate)
    );
  };

  const handleSave = () => {
    if (!isValid()) {
      const totalFragmented = getTotalFragmentQuantity();
      let errorMsg = "";

      if (totalFragmented === 0) {
        errorMsg = "Você deve fragmentar pelo menos 1 unidade.";
      } else if (totalFragmented > productTotalQuantity) {
        errorMsg = `A quantidade total fragmentada (${totalFragmented}) não pode ser maior que a quantidade total do produto (${productTotalQuantity}).`;
      } else {
        errorMsg = "Todos os campos obrigatórios devem ser preenchidos.";
      }

      toast({
        title: "Erro de Validação",
        description: errorMsg,
        variant: "destructive",
      });
      return;
    }

    // Filtrar fragmentos dos outros produtos
    const otherFragments = initialFragments.filter(
      (f) => f.productId !== selectedProductId,
    );

    const baseOrderId = order.id;

    const currentProductFragments: OrderFragmentType[] = fragments.map(
      (fragment, index) => {
        const { _tempId, ...rest } = fragment;
        return {
          id:
            fragment.id ||
            `${baseOrderId}-frag-${fragment.fragmentNumber || index + 1}-${Date.now()}`,
          orderId: baseOrderId,
          productId: selectedProductId,
          productName: selectedProduct?.product_name || "",
          size: selectedProduct?.size || "",
          color: selectedProduct?.color || "",
          fragmentNumber: fragment.fragmentNumber || index + 1,
          quantity: fragment.quantity || 0,
          scheduledDate: fragment.scheduledDate || new Date(),
          status: fragment.status || "pending",
          progress: fragment.progress || 0,
          value: calculateFragmentValue(fragment.quantity || 0),
          assignedOperator: fragment.assignedOperator,
          startedAt: fragment.startedAt,
          completedAt: fragment.completedAt,
        };
      },
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
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Divida a produção de unidades em lotes menores
            </p>
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 text-sm text-blue-700 dark:text-blue-400">
              <div className="flex items-start gap-2">
                <span className="font-medium">💡 Dica:</span>
                <span>Define um <strong>dia de produção diferente</strong> para cada fragmento. Assim cada lote aparecerá em seu respectivo dia no calendário.</span>
              </div>
            </div>
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
                      <div className="flex flex-col">
                        <span className="font-medium">
                          {product.product_name}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {product.model} • {product.color} • {product.size}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Product Details */}
          {selectedProduct && (
            <div className="p-4 border border-border rounded-lg bg-muted/5">
              <h3 className="font-semibold text-base mb-3 flex items-center">
                <Package className="h-4 w-4 mr-2" />
                Detalhes do Produto
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-muted-foreground text-xs">Nome</p>
                  <p className="font-medium">{selectedProduct.product_name}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Modelo</p>
                  <p className="font-medium">{selectedProduct.model || "—"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Tamanho</p>
                  <p className="font-medium">{selectedProduct.size || "—"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Cor</p>
                  <p className="font-medium">{selectedProduct.color || "—"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Tecido</p>
                  <p className="font-medium">{selectedProduct.fabric || "—"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">
                    Quantidade Total
                  </p>
                  <p className="font-medium text-biobox-green">
                    {productTotalQuantity} unidades
                  </p>
                </div>
              </div>
              {selectedProduct.specifications &&
                Object.keys(selectedProduct.specifications).length > 0 && (
                  <div className="mt-3 pt-3 border-t border-border">
                    <p className="text-muted-foreground text-xs mb-2">
                      Especificações
                    </p>
                    <div className="space-y-1">
                      {Object.entries(selectedProduct.specifications).map(
                        ([key, value]) => (
                          <div
                            key={key}
                            className="flex justify-between text-xs"
                          >
                            <span className="text-muted-foreground">
                              {key}:
                            </span>
                            <span className="font-medium">{String(value)}</span>
                          </div>
                        ),
                      )}
                    </div>
                  </div>
                )}
            </div>
          )}

          {/* Summary */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 p-4 bg-muted/5 rounded-lg border border-border">
            <div className="text-center">
              <p className="text-xs text-muted-foreground">Qtd. Disponível</p>
              <p className="text-lg font-bold text-biobox-green">
                {productTotalQuantity}
              </p>
            </div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground">Preço Unit.</p>
              <p className="text-lg font-bold">
                {formatCurrency(selectedProduct?.unit_price || 0)}
              </p>
            </div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground">Total</p>
              <p className="text-lg font-bold">
                {formatCurrency(productTotalValue)}
              </p>
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
              <Card key={fragment._tempId} className="bg-muted/5 border-dashed">
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
                      <Label className="flex items-center gap-2">
                        <CalendarIcon className="h-4 w-4" />
                        <span>Dia de Produção *</span>
                      </Label>
                      <Popover
                        open={showCalendar === index}
                        onOpenChange={(open) =>
                          setShowCalendar(open ? index : null)
                        }
                      >
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className="w-full justify-start text-left font-normal bg-primary/5 hover:bg-primary/10 border-primary/20"
                          >
                            <CalendarIcon className="mr-2 h-4 w-4 text-primary" />
                            <span className="font-medium">
                              {fragment.scheduledDate
                                ? format(fragment.scheduledDate, "dd/MM/yyyy (EEEE)", {
                                    locale: ptBR,
                                  })
                                : "Clique para selecionar"}
                            </span>
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
                      <p className="text-xs text-muted-foreground mt-1">
                        Fragmento {fragment.fragmentNumber} de {fragments.length}
                      </p>
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
              <span className="text-sm font-medium">
                Resumo da Fragmentação
              </span>
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
                <span>Fragmentado:</span>
                <span className="font-medium text-biobox-green">
                  {getTotalFragmentQuantity()} unidade(s)
                </span>
              </div>
              <div className="flex justify-between">
                <span>Saldo:</span>
                <span
                  className={cn(
                    "font-medium",
                    productTotalQuantity - getTotalFragmentQuantity() > 0
                      ? "text-orange-500"
                      : "text-biobox-green",
                  )}
                >
                  {productTotalQuantity - getTotalFragmentQuantity()} unidade(s)
                </span>
              </div>
              <div className="flex justify-between">
                <span>Total do Produto:</span>
                <span className="font-medium">
                  {productTotalQuantity} unidade(s)
                </span>
              </div>
              <div className="flex justify-between">
                <span>Valor Fragmentado:</span>
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
