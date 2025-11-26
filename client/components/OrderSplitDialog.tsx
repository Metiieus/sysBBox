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
import { Order, OrderProduct } from "@/hooks/useFirebase";
import { AlertCircle } from "lucide-react";

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

  const handleQuantityChange = (productId: string, value: string) => {
    const num = parseInt(value) || 0;
    setQuantities((prev) => ({
      ...prev,
      [productId]: Math.max(0, num),
    }));
  };

  const handleSplit = async () => {
    try {
      setLoading(true);

      // Validar que pelo menos uma quantidade foi especificada
      const hasQuantity = Object.values(quantities).some((q) => q > 0);
      if (!hasQuantity) {
        alert("Por favor, especifique a quantidade para pelo menos um produto");
        return;
      }

      // Validar que as quantidades não excedem a quantidade do produto
      const hasExcess = order.products?.some((product) => {
        const qty = quantities[product.id] || 0;
        return qty > product.quantity;
      });

      if (hasExcess) {
        alert(
          "A quantidade especificada não pode ser maior que a quantidade do produto"
        );
        return;
      }

      // Criar fragmentos para cada produto com quantidade especificada
      const fragments = order.products
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
          value: (product.total_price / product.quantity) * (quantities[product.id] || 0),
          assigned_operator: undefined,
          started_at: undefined,
          completed_at: undefined,
        })) || [];

      await onSplit(fragments);

      // Limpar formulário
      setQuantities({});
      onOpenChange(false);
    } catch (error) {
      console.error("Erro ao fragmentar pedido:", error);
      alert("Erro ao fragmentar pedido. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Fragmentar Pedido - {order.order_number}</DialogTitle>
          <DialogDescription>
            Especifique quantos itens de cada produto deseja enviar para
            produção. Os itens restantes ficarão como saldo.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 max-h-[400px] overflow-y-auto">
          {order.products && order.products.length > 0 ? (
            order.products.map((product, index) => {
              const maxQty = product.quantity;
              const currentQty = quantities[product.id] || 0;
              const remaining = maxQty - currentQty;

              return (
                <div
                  key={`${product.id}-${index}`}
                  className="p-4 border border-border rounded-lg space-y-3"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="font-medium">{product.product_name}</div>
                      <div className="text-sm text-muted-foreground">
                        Tamanho: {product.size} | Cor: {product.color}
                      </div>
                      <div className="text-sm text-muted-foreground mt-1">
                        Quantidade total: {maxQty} unidades
                      </div>
                    </div>
                  </div>

                  <div className="flex items-end gap-4">
                    <div className="flex-1">
                      <Label htmlFor={`qty-${product.id}`} className="mb-2 block">
                        Enviar para produção:
                      </Label>
                      <Input
                        id={`qty-${product.id}`}
                        type="number"
                        min="0"
                        max={maxQty}
                        value={currentQty}
                        onChange={(e) =>
                          handleQuantityChange(product.id, e.target.value)
                        }
                        className="w-20"
                        disabled={loading}
                      />
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-medium">
                        Saldo restante: <span className="text-orange-600">{remaining}</span>
                      </div>
                    </div>
                  </div>
                </div>
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

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
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
