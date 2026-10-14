import 'package:boya_shared/boya_shared.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';

import '../../core/network/api_client.dart';
import '../../core/network/upload_api.dart';

/// Label + preview + pick/delete controls for one image uploaded through
/// `POST /upload/image`.
///
/// A controlled component: [value] is the stored URL (empty when there is
/// no image) and every change — a finished upload or a delete — is reported
/// through [onChanged], so the owning form keeps the value (and its
/// controller) as the single source of truth. Upload failures surface as a
/// snackbar carrying the backend's Persian message (`messageFromDio`).
class ImageUploadField extends ConsumerStatefulWidget {
  const ImageUploadField({
    super.key,
    required this.label,
    required this.category,
    required this.value,
    required this.onChanged,
    this.aspectRatio = 16 / 9,
  });

  final String label;

  /// The backend's folder tier — `cover`, `specialist`, `portfolio` or
  /// `general` (an unvalidated value is rejected server-side).
  final String category;

  /// The stored URL of the current image, `''` when there is none.
  final String value;

  final ValueChanged<String> onChanged;

  /// Preview shape; portrait contexts (a specialist avatar) pass 1.
  final double aspectRatio;

  @override
  ConsumerState<ImageUploadField> createState() => _ImageUploadFieldState();
}

class _ImageUploadFieldState extends ConsumerState<ImageUploadField> {
  bool _uploading = false;

  Future<void> _pickAndUpload() async {
    final picked = await ImagePicker().pickImage(
      source: ImageSource.gallery,
      // The backend caps uploads at 5 MB; a compressed long-edge-1600 JPEG
      // stays well under that while still sharp enough for a cover photo.
      maxWidth: 1600,
      imageQuality: 85,
    );
    if (picked == null) return; // The picker was dismissed.

    // The owning screen may rebuild while the upload runs, so the messenger
    // is only reached inside the handlers below, with `mounted` checked.
    setState(() => _uploading = true);
    try {
      final url = await ref.read(uploadApiProvider).uploadImage(
            bytes: await picked.readAsBytes(),
            filename: picked.name,
            category: widget.category,
          );
      if (!mounted || url.isEmpty) return;
      widget.onChanged(url);
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(messageFromDio(error))),
      );
    } finally {
      if (mounted) setState(() => _uploading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final hasImage = widget.value.isNotEmpty;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(widget.label, style: BoyaTypography.caption),
        const SizedBox(height: 4),
        if (hasImage)
          ClipRRect(
            borderRadius: BorderRadius.circular(12),
            child: AspectRatio(
              aspectRatio: widget.aspectRatio,
              child: Image.network(
                resolveUploadUrl(widget.value),
                fit: BoxFit.cover,
                errorBuilder: (context, error, stackTrace) => const ColoredBox(
                  color: BoyaColors.line,
                  child: Icon(Icons.broken_image_outlined, color: BoyaColors.inkMuted),
                ),
              ),
            ),
          ),
        const SizedBox(height: 8),
        Row(
          children: [
            OutlinedButton.icon(
              onPressed: _uploading ? null : _pickAndUpload,
              icon: _uploading
                  ? const SizedBox(
                      width: 16,
                      height: 16,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(Icons.photo_library_outlined),
              label: Text(hasImage ? 'تعویض تصویر' : 'انتخاب تصویر'),
            ),
            if (hasImage) ...[
              const SizedBox(width: 8),
              TextButton.icon(
                onPressed: _uploading ? null : () => widget.onChanged(''),
                icon: const Icon(Icons.delete_outline),
                label: const Text('حذف'),
              ),
            ],
          ],
        ),
      ],
    );
  }
}
