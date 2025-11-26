import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Order, OrderProduct } from "@/hooks/useFirebase";
import { AlertCircle, Minus, Plus } from "lucide-react";

interface OrderSplitDialogProps {
  order: Order | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSplit: (fragments: any[]) => Promise<void>;
}

export default function OrderSplitDialog({
  order,
  open,
  onOpenChange,
  onSplit,
}: OrderSplitDialogProps) {
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);

  if (!order) return null;

  const getAvailableQuantity = (productId: string): number => {
    const product = order.products?.find(
      (p) => p.id === productId || p.product_id === productId,
    );
    if (!product) return 0;

    const totalQuantity = product.quantity;
    const actualProductId = product.product_id || product.id;
    const alreadyFragmented =
      order.fragments?.reduce((sum, f) => {
        return sum +
          (f.product_id === actualProductId ||
           f.product_id === productId ||
           f.product_id === product.id
            ? f.quantity
            : 0);
      }, 0) || 0;

    return totalQuantity - alreadyFragmented;
  };

  const handleQuantityChange = (productId: string, value: string) => {
    const availableQty = getAvailableQuantity(productId);
    const num = Math.min(availableQty, Math.max(0, parseInt(value) || 0));
    setQuantities((prev) => ({
      ...prev,
      [productId]: num,
    }));
  };

  const incrementQuantity = (productId: string) => {
    const availableQty = getAvailableQuantity(productId);
    const current = quantities[productId] || 0;
    if (current < availableQty) {
      setQuantities((prev) => ({
        ...prev,
        [productId]: current + 1,
      }));
    }
  };

  const decrementQuantity = (productId: string) => {
    const current = quantities[productId] || 0;
    if (current > 0) {
      setQuantities((prev) => ({
        ...prev,
        [productId]: current - 1,
      }));
    }
  };

  const handleSplit = async () => {
    try {
      setLoading(true);

      const hasQuantity = Object.values(quantities).some((q) => q > 0);
      if (!hasQuantity) {
        alert("Por favor, especifique a quantidade para pelo menos um produto");
        return;
      }

      const hasExcess = order.products?.some((product) => {
        const qty = quantities[product.id] || 0;
        const availableQty = getAvailableQuantity(product.id);
        return qty > availableQty;
      });

      if (hasExcess) {
        alert(
          "A quantidade especificada não pode ser maior que a quantidade disponível para fragmentar",
        );
        return;
      }

      const fragments =
        order.products
          ?.filter((product) => (quantities[product.id] || 0) > 0)
          .map((product, index) => ({
            id: `${order.id}-frag-${Date.now()}-${index}`,
            order_id: order.id,
            product_id: product.product_id || product.id,
            product_name: product.product_name,
            size: product.size,
            color: product.color,
            fragment_number: (order.fragments?.length || 0) + index + 1,
            quantity: quantities[product.id] || 0,
            scheduled_date: new Date().toISOString(),
            status: "pending" as const,
            progress: 0,
            value:
              (product.total_price / product.quantity) *
              (quantities[product.id] || 0),
            assigned_operator: undefined,
            started_at: undefined,
            completed_at: undefined,
          })) || [];

      await onSplit(fragments);

      setQuantities({});
      onOpenChange(false);
    } catch (error) {
      console.error("Erro ao fragmentar pedido:", error);
      alert("Erro ao fragmentar pedido. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="border-b pb-4">
          <DialogTitle className="text-2xl">Fragmentar Pedido</DialogTitle>
          <DialogDescription className="mt-2">
            <div className="space-y-1">
              <p>
                <strong>Pedido:</strong> {order.order_number}
              </p>
              <p>
                <strong>Cliente:</strong> {order.customer_name}
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                Especifique quantos itens de cada produto deseja enviar para
                produção. Os itens restantes ficarão como saldo.
              </p>
            </div>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 my-6">
          {order.products && order.products.length > 0 ? (
            order.products.map((product, index) => {
              const maxQty = product.quantity;
              const currentQty = quantities[product.id] || 0;
              const remaining = maxQty - currentQty;
              const unitPrice = product.unit_price;
              const selectedValue = unitPrice * currentQty;

              return (
                <Card key={`${product.id}-${index}`} className="border">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-lg">
                          {product.product_name}
                        </CardTitle>
                        {product.model && (
                          <p className="text-sm text-muted-foreground mt-1">
                            Modelo: {product.model}
                          </p>
                        )}
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-medium text-muted-foreground">
                          Valor Unitário
                        </div>
                        <div className="text-lg font-semibold">
                          {formatCurrency(unitPrice)}
                        </div>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4 md:grid-cols-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Tamanho</p>
                        <p className="font-medium">{product.size || "-"}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Cor</p>
                        <p className="font-medium">{product.color || "-"}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Tecido</p>
                        <p className="font-medium">{product.fabric || "-"}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">
                          Quantidade Total
                        </p>
                        <p className="font-medium text-lg">{maxQty}</p>
                      </div>
                    </div>

                    {(() => {
                      const actualProductId = product.product_id || product.id;
                      const alreadyFragmented =
                        order.fragments?.reduce((sum, f) => {
                          return (
                            sum +
                            (f.product_id === actualProductId ||
                             f.product_id === product.id
                              ? f.quantity
                              : 0)
                          );
                        }, 0) || 0;
                      const availableQty = maxQty - alreadyFragmented;

                      return (
                        <div className="border-t pt-4">
                          <div className="grid grid-cols-2 gap-3 text-sm mb-3">
                            <div className="p-2 bg-green-50 dark:bg-green-500/10 rounded border border-green-200 dark:border-green-500/30">
                              <p className="text-xs text-muted-foreground">
                                Já Fragmentado
                              </p>
                              <p className="font-bold text-green-700 dark:text-green-400">
                                {alreadyFragmented} un.
                              </p>
                            </div>
                            <div className="p-2 bg-orange-50 dark:bg-orange-500/10 rounded border border-orange-200 dark:border-orange-500/30">
                              <p className="text-xs text-muted-foreground">
                                Disponível
                              </p>
                              <p className="font-bold text-orange-700 dark:text-orange-400">
                                {availableQty} un.
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    })()}

                    <div className="border-t pt-4">
                      <Label className="text-base font-semibold mb-3 block">
                        Quantidade para Produção
                      </Label>

                      {(() => {
                        const availableQty = getAvailableQuantity(product.id);
                        const remainingAfterSplit = availableQty - currentQty;
                        const isAllFragmented = availableQty <= 0;

                        return (
                          <div className="flex items-center gap-4">
                            <div className="flex items-center border rounded-lg bg-muted/30">
                              <button
                                onClick={() => decrementQuantity(product.id)}
                                disabled={loading || currentQty === 0}
                                className="p-2 hover:bg-muted disabled:opacity-50"
                              >
                                <Minus className="h-4 w-4" />
                              </button>
                              <Input
                                type="number"
                                min="0"
                                max={Math.max(0, availableQty)}
                                value={currentQty}
                                onChange={(e) =>
                                  handleQuantityChange(
                                    product.id,
                                    e.target.value,
                                  )
                                }
                                className="border-0 text-center w-16 bg-transparent text-lg font-semibold disabled:opacity-50"
                                disabled={loading || isAllFragmented}
                              />
                              <button
                                onClick={() => incrementQuantity(product.id)}
                                disabled={
                                  loading ||
                                  currentQty >= availableQty ||
                                  availableQty <= 0
                                }
                                className="p-2 hover:bg-muted disabled:opacity-50"
                              >
                                <Plus className="h-4 w-4" />
                              </button>
                            </div>

                            <div className="flex-1 space-y-2">
                              <div className="flex justify-between items-center">
                                <span className="text-sm text-muted-foreground">
                                  Faltará Fragmentar:
                                </span>
                                <span
                                  className={`text-lg font-semibold ${
                                    remainingAfterSplit > 0
                                      ? "text-red-600"
                                      : "text-green-600"
                                  }`}
                                >
                                  {remainingAfterSplit}
                                </span>
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="text-sm text-muted-foreground">
                                  Valor Selecionado:
                                </span>
                                <span className="text-lg font-semibold">
                                  {formatCurrency(selectedValue)}
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })()}

                      {currentQty > 0 && (
                        <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded text-sm text-blue-700">
                          ✓ {currentQty} unidade(s) será(ão) enviada(s) para
                          produção
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })
          ) : (
            <div className="flex items-center gap-2 p-4 bg-orange-50 border border-orange-200 rounded-lg">
              <AlertCircle className="h-5 w-5 text-orange-600" />
              <p className="text-sm text-orange-800">
                Este pedido não possui produtos cadastrados
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="border-t pt-4">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancelar
          </Button>
          <Button onClick={handleSplit} disabled={loading}>
            {loading ? "Fragmentando..." : "Fragmentar Pedido"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
