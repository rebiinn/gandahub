<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Inventory records: product, supplier (store), quantity, stocked date.
     * Created when a supplier approves a stock request.
     */
    public function up(): void
    {
        Schema::create('inventory_receipts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('product_id')->constrained()->onDelete('cascade');
            $table->foreignId('store_id')->constrained()->onDelete('cascade');
            $table->foreignId('stock_request_id')->nullable()->constrained()->onDelete('set null');
            $table->integer('quantity');
            $table->date('stocked_date');
            $table->timestamps();

            $table->index(['product_id', 'stocked_date']);
            $table->index(['store_id', 'stocked_date']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('inventory_receipts');
    }
};
