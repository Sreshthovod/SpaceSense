import { ExternalLink, ShieldCheck } from 'lucide-react'
import { formatINR } from '../../utils/format'
import { formatChecked, safeHttpsUrl } from '../../utils/productPlan'
import { findProduct } from '../hooks/useStudioCatalog'
import { parseListedSize } from '../model/floorPlacement'

/**
 * Which real product a placed shape stands for. Only verified products for this item type are
 * offered; "Generic shape" means no product and no price. Nothing is picked automatically.
 */
export default function ProductPicker({ item, catalog, catalogError, dispatch, disabled = false }) {
  const products = catalog?.types?.[item.catalogId]?.products || []
  const chosen = findProduct(catalog, item.catalogId, item.productId)
  const id = `product-${item.uid}`

  if (!catalog) {
    return <p className="text-[11px] text-muted">{catalogError ? 'Product prices are unavailable right now.' : 'Loading products…'}</p>
  }
  if (!products.length) {
    return <p className="text-[11px] text-muted">Generic shape. There's no verified catalog product for this item yet, so it has no price.</p>
  }
  const url = chosen && safeHttpsUrl(chosen.product_url)
  return (
    <div>
      <label htmlFor={id} className="block text-xs font-semibold">Product</label>
      <select
        id={id}
        value={item.productId || ''}
        disabled={disabled}
        onChange={(e) => {
          const product = products.find((p) => p.product_id === e.target.value)
          // Floor pieces take the product's listed size when it's unambiguous (W × D × H).
          const size = !item.wall && product ? parseListedSize(product.listed_size) : null
          dispatch({ type: 'setProduct', uid: item.uid, productId: product?.product_id || null, ...(size ? { size } : {}) })
        }}
        className="mt-1 w-full rounded-lg border border-line bg-white px-2.5 py-1.5 text-sm focus:border-sage-dark focus:outline-none focus:ring-2 focus:ring-sage-dark disabled:bg-sand disabled:text-muted"
      >
        <option value="">Generic shape (not a product, no price)</option>
        {products.map((p) => (
          <option key={p.product_id} value={p.product_id}>{p.name} — {formatINR(p.price_inr)}</option>
        ))}
      </select>
      {chosen ? (
        <div className="mt-2 rounded-lg bg-sand/60 p-2 text-[11px]">
          <p className="flex items-center gap-1 font-semibold text-sage-dark">
            <ShieldCheck aria-hidden="true" className="h-3.5 w-3.5" /> {formatINR(chosen.price_inr)} · verified {formatChecked(chosen.last_checked)}
          </p>
          {chosen.listed_size && (
            <p className="mt-0.5 text-muted">
              Listed size: {chosen.listed_size}.{' '}
              {item.size ? 'The 3D shape uses this size.' : "The 3D shape is a typical size, not this product's exact size."}
            </p>
          )}
          {url && (
            <a href={url} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-1 font-semibold underline underline-offset-2">
              View on {chosen.retailer} <ExternalLink aria-hidden="true" className="h-3 w-3" />
              <span className="sr-only">(opens in a new tab)</span>
            </a>
          )}
        </div>
      ) : (
        <p className="mt-1 text-[11px] text-muted">Not counted in your budget until you pick a product.</p>
      )}
    </div>
  )
}
