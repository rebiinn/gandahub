<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->string('cancellation_reason')->nullable()->after('notes');
            $table->string('cancellation_previous_status')->nullable()->after('cancellation_reason');
            $table->timestamp('cancellation_requested_at')->nullable()->after('cancellation_previous_status');
            $table->timestamp('cancellation_reviewed_at')->nullable()->after('cancellation_requested_at');
            $table->text('cancellation_review_note')->nullable()->after('cancellation_reviewed_at');
            $table->foreignId('cancellation_reviewed_by')
                ->nullable()
                ->after('cancellation_review_note')
                ->constrained('users')
                ->nullOnDelete();
        });

        // Keep enum in sync for customer->seller cancellation request workflow.
        DB::statement(
            "ALTER TABLE `orders` MODIFY `status` ENUM(
                'pending',
                'confirmed',
                'processing',
                'cancel_requested',
                'shipped',
                'out_for_delivery',
                'delivered',
                'cancelled',
                'refunded'
            ) NOT NULL DEFAULT 'pending'"
        );
    }

    public function down(): void
    {
        DB::statement(
            "ALTER TABLE `orders` MODIFY `status` ENUM(
                'pending',
                'confirmed',
                'processing',
                'shipped',
                'out_for_delivery',
                'delivered',
                'cancelled',
                'refunded'
            ) NOT NULL DEFAULT 'pending'"
        );

        Schema::table('orders', function (Blueprint $table) {
            $table->dropConstrainedForeignId('cancellation_reviewed_by');
            $table->dropColumn([
                'cancellation_reason',
                'cancellation_previous_status',
                'cancellation_requested_at',
                'cancellation_reviewed_at',
                'cancellation_review_note',
            ]);
        });
    }
};

