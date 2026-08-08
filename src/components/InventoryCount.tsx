import React, { useState } from 'react';
import { Product } from '@/src/types/types';
import { db } from '@/src/lib/firebase';
import { updateDoc, doc } from 'firebase/firestore';
import { logActivity } from '@/src/lib/activity';

export default function InventoryCount({ products, setProducts }: { products: Product[], setProducts: React.Dispatch<React.SetStateAction<Product[]>> }) {
    const [counts, setCounts] = useState<Record<string, string>>({});

    const saveCount = async (product: Product) => {
        const newQuantity = parseInt(counts[product.id] || '0');
        if (isNaN(newQuantity)) return;
        
        await updateDoc(doc(db, 'products', product.id), { quantity: newQuantity });
        setProducts(products.map(p => p.id === product.id ? { ...p, quantity: newQuantity } : p));
        logActivity(`تم جرد المنتج ${product.name} وتعديل الكمية إلى ${newQuantity}`);
        alert('تم حفظ الجرد');
    };

    return (
        <div className="space-y-4 pt-4">
            {products.filter(p => !p.archived).map(product => (
                <div key={product.id} className="bg-card p-3 rounded-2xl border border-border flex justify-between items-center">
                    <span>{product.name}</span>
                    <div className='flex gap-2'>
                        <input 
                            type="number" 
                            className="bg-card2 border border-border p-2 rounded-xl w-20 text-center"
                            placeholder={product.quantity.toString()}
                            value={counts[product.id] ?? ''}
                            onChange={e => setCounts({...counts, [product.id]: e.target.value})}
                        />
                        <button onClick={() => saveCount(product)} className="bg-gold text-white p-2 rounded-xl text-sm font-bold">حفظ</button>
                    </div>
                </div>
            ))}
        </div>
    );
}
