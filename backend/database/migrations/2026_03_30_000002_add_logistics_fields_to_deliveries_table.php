<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('deliveries', function (Blueprint $table) {
            $table->string('logistics_provider')->nullable()->after('status');
            $table->string('logistics_station_name')->nullable()->after('logistics_provider');
            $table->text('logistics_station_address')->nullable()->after('logistics_station_name');
            $table->string('logistics_station_city')->nullable()->after('logistics_station_address');
            $table->timestamp('station_arrived_at')->nullable()->after('logistics_station_city');
            $table->timestamp('auto_assigned_at')->nullable()->after('station_arrived_at');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('deliveries', function (Blueprint $table) {
            $table->dropColumn([
                'logistics_provider',
                'logistics_station_name',
                'logistics_station_address',
                'logistics_station_city',
                'station_arrived_at',
                'auto_assigned_at',
            ]);
        });
    }
};
