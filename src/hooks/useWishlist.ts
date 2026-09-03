'use client';
import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from './useAuth';

export function useWishlist() {
  const { user } = useAuth();
  const supabase = createClient();
  const [wishlist, setWishlist] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) { setWishlist([]); return; }
    const fetch = async () => {
      const { data } = await supabase
        .from('wishlists')
        .select('product_id')
        .eq('user_id', user.id);
      setWishlist((data ?? []).map((w) => w.product_id));
    };
    fetch();
  }, [user]);

  const toggle = useCallback(async (productId: string) => {
    if (!user) return;
    setLoading(true);
    const inWishlist = wishlist.includes(productId);
    if (inWishlist) {
      await supabase.from('wishlists')
        .delete().eq('user_id', user.id).eq('product_id', productId);
      setWishlist((prev) => prev.filter((id) => id !== productId));
    } else {
      await supabase.from('wishlists')
        .insert({ user_id: user.id, product_id: productId });
      setWishlist((prev) => [...prev, productId]);
    }
    setLoading(false);
  }, [user, wishlist]);

  return { wishlist, toggle, isInWishlist: (id: string) => wishlist.includes(id), loading };
}
