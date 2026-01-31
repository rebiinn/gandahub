<?php

namespace Database\Seeders;

use App\Models\Category;
use App\Models\Product;
use App\Models\SystemSetting;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        // Create Admin User
        User::create([
            'first_name' => 'Admin',
            'last_name' => 'User',
            'email' => 'admin@gandahub.com',
            'password' => Hash::make('password123'),
            'role' => 'admin',
            'phone' => '+63 912 345 6789',
            'is_active' => true,
        ]);

        // Create Sample Rider
        User::create([
            'first_name' => 'Juan',
            'last_name' => 'Rider',
            'email' => 'rider@gandahub.com',
            'password' => Hash::make('password123'),
            'role' => 'rider',
            'phone' => '+63 912 345 6780',
            'is_active' => true,
        ]);

        // Create Sample Customer
        User::create([
            'first_name' => 'Maria',
            'last_name' => 'Customer',
            'email' => 'customer@gandahub.com',
            'password' => Hash::make('password123'),
            'role' => 'customer',
            'phone' => '+63 912 345 6781',
            'address' => '123 Main Street, Brgy. Sample',
            'city' => 'Makati City',
            'state' => 'Metro Manila',
            'zip_code' => '1234',
            'is_active' => true,
        ]);

        // Create Categories
        $categories = [
            ['name' => 'Face', 'slug' => 'face', 'description' => 'Face makeup and skincare products'],
            ['name' => 'Lips', 'slug' => 'lips', 'description' => 'Lipsticks, lip glosses, and lip care'],
            ['name' => 'Eyes', 'slug' => 'eyes', 'description' => 'Eyeshadows, mascaras, and eyeliners'],
            ['name' => 'Skincare', 'slug' => 'skincare', 'description' => 'Cleansers, moisturizers, and serums'],
            ['name' => 'Nails', 'slug' => 'nails', 'description' => 'Nail polish and nail care'],
            ['name' => 'Tools', 'slug' => 'tools', 'description' => 'Makeup brushes and accessories'],
        ];

        foreach ($categories as $category) {
            Category::create(array_merge($category, ['is_active' => true]));
        }

        // Create Sample Products with images
        $products = [
            [
                'category_id' => 1,
                'name' => 'Velvet Matte Foundation',
                'slug' => 'velvet-matte-foundation',
                'sku' => 'GHC-FND-001',
                'description' => 'A luxurious full-coverage foundation that provides a velvet matte finish. Long-lasting formula that keeps your skin looking flawless all day.',
                'short_description' => 'Full-coverage matte foundation for all-day wear',
                'price' => 899.00,
                'sale_price' => 749.00,
                'stock_quantity' => 50,
                'brand' => 'Ganda Hub',
                'thumbnail' => '/images/products/foundation-lipgloss.png',
                'is_featured' => true,
                'is_active' => true,
            ],
            [
                'category_id' => 2,
                'name' => 'Hydrating Lip Gloss',
                'slug' => 'hydrating-lip-gloss',
                'sku' => 'GHC-LIP-001',
                'description' => 'A moisturizing lip gloss with a brilliant shine. Infused with vitamin E and jojoba oil to keep your lips soft and hydrated.',
                'short_description' => 'Brilliant shine lip gloss with vitamin E',
                'price' => 399.00,
                'stock_quantity' => 100,
                'brand' => 'Ganda Hub',
                'thumbnail' => '/images/products/foundation-lipgloss.png',
                'is_featured' => true,
                'is_active' => true,
            ],
            [
                'category_id' => 3,
                'name' => 'Smoky Eye Palette',
                'slug' => 'smoky-eye-palette',
                'sku' => 'GHC-EYE-001',
                'description' => '12-shade eyeshadow palette with a mix of matte and shimmer finishes. Create stunning smoky eye looks with rich, blendable colors.',
                'short_description' => '12-shade eyeshadow palette for stunning looks',
                'price' => 1299.00,
                'sale_price' => 999.00,
                'stock_quantity' => 30,
                'brand' => 'Ganda Hub',
                'thumbnail' => '/images/products/palette-serum.png',
                'is_featured' => true,
                'is_active' => true,
            ],
            [
                'category_id' => 4,
                'name' => 'Vitamin C Serum',
                'slug' => 'vitamin-c-serum',
                'sku' => 'GHC-SKN-001',
                'description' => 'Brightening serum with 20% Vitamin C. Reduces dark spots, evens skin tone, and boosts collagen production for youthful, radiant skin.',
                'short_description' => 'Brightening serum with 20% Vitamin C',
                'price' => 1499.00,
                'stock_quantity' => 45,
                'brand' => 'Ganda Hub',
                'thumbnail' => '/images/products/palette-serum.png',
                'is_featured' => true,
                'is_active' => true,
            ],
            [
                'category_id' => 2,
                'name' => 'Long-Wear Matte Lipstick',
                'slug' => 'long-wear-matte-lipstick',
                'sku' => 'GHC-LIP-002',
                'description' => 'A richly pigmented matte lipstick that lasts up to 16 hours. Comfortable, non-drying formula in a range of stunning shades.',
                'short_description' => '16-hour wear matte lipstick',
                'price' => 549.00,
                'stock_quantity' => 80,
                'brand' => 'Ganda Hub',
                'thumbnail' => '/images/products/lipstick-mascara.png',
                'is_active' => true,
            ],
            [
                'category_id' => 3,
                'name' => 'Volumizing Mascara',
                'slug' => 'volumizing-mascara',
                'sku' => 'GHC-EYE-002',
                'description' => 'Dramatic volume mascara with a unique brush that coats each lash for bold, voluminous lashes. Smudge-proof and long-lasting.',
                'short_description' => 'Bold volume mascara for dramatic lashes',
                'price' => 599.00,
                'stock_quantity' => 60,
                'brand' => 'Ganda Hub',
                'thumbnail' => '/images/products/lipstick-mascara.png',
                'is_active' => true,
            ],
            [
                'category_id' => 4,
                'name' => 'Hydrating Moisturizer',
                'slug' => 'hydrating-moisturizer',
                'sku' => 'GHC-SKN-002',
                'description' => 'Lightweight gel moisturizer with hyaluronic acid. Provides 72-hour hydration while improving skin texture and elasticity.',
                'short_description' => '72-hour hydration gel moisturizer',
                'price' => 899.00,
                'stock_quantity' => 55,
                'brand' => 'Ganda Hub',
                'thumbnail' => '/images/products/moisturizer-nailpolish.png',
                'is_active' => true,
            ],
            [
                'category_id' => 5,
                'name' => 'Gel Nail Polish Set',
                'slug' => 'gel-nail-polish-set',
                'sku' => 'GHC-NAL-001',
                'description' => '6-piece gel nail polish set with trendy colors. Chip-resistant formula with high shine finish that lasts up to 2 weeks.',
                'short_description' => '6-piece gel nail polish with 2-week wear',
                'price' => 799.00,
                'sale_price' => 649.00,
                'stock_quantity' => 40,
                'brand' => 'Ganda Hub',
                'thumbnail' => '/images/products/moisturizer-nailpolish.png',
                'is_active' => true,
            ],
            [
                'category_id' => 6,
                'name' => 'Professional Brush Set',
                'slug' => 'professional-brush-set',
                'sku' => 'GHC-TLS-001',
                'description' => '15-piece professional makeup brush set with synthetic bristles. Includes all essential brushes for face, eyes, and lips with a stylish case.',
                'short_description' => '15-piece professional makeup brush set',
                'price' => 1999.00,
                'stock_quantity' => 25,
                'brand' => 'Ganda Hub',
                'thumbnail' => '/images/products/brushset-primer.png',
                'is_featured' => true,
                'is_active' => true,
            ],
            [
                'category_id' => 1,
                'name' => 'Illuminating Primer',
                'slug' => 'illuminating-primer',
                'sku' => 'GHC-FND-002',
                'description' => 'Radiance-boosting primer that creates a luminous base for makeup. Minimizes pores and extends makeup wear time.',
                'short_description' => 'Radiance-boosting makeup primer',
                'price' => 699.00,
                'stock_quantity' => 65,
                'brand' => 'Ganda Hub',
                'thumbnail' => '/images/products/brushset-primer.png',
                'is_active' => true,
            ],
        ];

        foreach ($products as $product) {
            Product::create($product);
        }

        // Create System Settings
        $settings = [
            ['key' => 'site_name', 'value' => 'Ganda Hub Cosmetics', 'type' => 'string', 'group' => 'general', 'is_public' => true],
            ['key' => 'site_tagline', 'value' => 'Beauty & Skincare', 'type' => 'string', 'group' => 'general', 'is_public' => true],
            ['key' => 'contact_email', 'value' => 'hello@gandahub.com', 'type' => 'string', 'group' => 'general', 'is_public' => true],
            ['key' => 'contact_phone', 'value' => '+63 (02) 8888-GANDA', 'type' => 'string', 'group' => 'general', 'is_public' => true],
            ['key' => 'currency', 'value' => 'PHP', 'type' => 'string', 'group' => 'payment', 'is_public' => true],
            ['key' => 'free_shipping_threshold', 'value' => '1500', 'type' => 'integer', 'group' => 'shipping', 'is_public' => true],
            ['key' => 'default_shipping_fee', 'value' => '150', 'type' => 'integer', 'group' => 'shipping', 'is_public' => true],
            ['key' => 'tax_rate', 'value' => '12', 'type' => 'integer', 'group' => 'tax', 'is_public' => false],
        ];

        foreach ($settings as $setting) {
            SystemSetting::create($setting);
        }

        $this->command->info('Database seeded successfully!');
        $this->command->info('Admin Login: admin@gandahub.com / password123');
        $this->command->info('Rider Login: rider@gandahub.com / password123');
        $this->command->info('Customer Login: customer@gandahub.com / password123');
    }
}
