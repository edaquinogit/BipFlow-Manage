from django.db.models.signals import post_delete, post_save
from django.dispatch import receiver

from .models import SaleOrder


@receiver(post_save, sender=SaleOrder)
@receiver(post_delete, sender=SaleOrder)
def invalidate_dashboard_cache_on_sale_order_write(sender, instance, **kwargs):
    """Keep dashboard aggregates from serving stale data after any SaleOrder write.

    Imported lazily (rather than at module load time) to avoid a models -> views
    import cycle, since `views.py` already imports from `models.py`.
    """
    from .views import invalidate_dashboard_cache

    invalidate_dashboard_cache(instance.store_id)
